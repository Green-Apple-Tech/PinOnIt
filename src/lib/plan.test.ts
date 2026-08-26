import { describe, expect, it } from 'vitest';
import { effectivePlan, isActivePlan, pickBestSubscription } from './plan';
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
  it('uses paid subscription over an expired profile', () => {
    expect(effectivePlan({ plan: 'pro', status: 'active' }, { plan: 'expired' })).toBe('pro');
  });

  it('returns trial while trialing and not past trial_ends_at', () => {
    const future = new Date(Date.now() + 86400000).toISOString();
    expect(
      effectivePlan({ plan: 'trial', status: 'trialing', trial_ends_at: future }, { plan: 'trial' }),
    ).toBe('trial');
  });

  it('returns expired when local trial ended', () => {
    const past = new Date(Date.now() - 86400000).toISOString();
    expect(
      effectivePlan({ plan: 'trial', status: 'trialing', trial_ends_at: past }, { plan: 'trial' }),
    ).toBe('expired');
  });

  it('keeps Pro when canceled but still inside the paid period', () => {
    const future = new Date(Date.now() + 86400000).toISOString();
    expect(
      effectivePlan({ plan: 'pro', status: 'canceled', stripe_current_period_end: future }, { plan: 'expired' }),
    ).toBe('pro');
  });

  it('shows expired after a canceled period has ended', () => {
    const past = new Date(Date.now() - 86400000).toISOString();
    expect(
      effectivePlan({ plan: 'pro', status: 'canceled', stripe_current_period_end: past }, { plan: 'pro' }),
    ).toBe('expired');
  });

  it('keeps complimentary Pro even after a canceled Stripe period has ended', () => {
    const past = new Date(Date.now() - 86400000).toISOString();
    expect(
      effectivePlan(
        { plan: 'pro', status: 'canceled', stripe_current_period_end: past },
        { plan: 'expired', plan_override: 'pro' },
      ),
    ).toBe('pro');
  });
});

describe('isActivePlan', () => {
  it('treats trial and pro as active', () => {
    expect(isActivePlan('trial')).toBe(true);
    expect(isActivePlan('pro')).toBe(true);
    expect(isActivePlan('expired')).toBe(false);
  });
});

describe('pickBestSubscription', () => {
  it('prefers a real Stripe subscription over a local trial row', () => {
    const trial = row({
      id: 'trial',
      stripe_customer_id: 'trial_u',
      stripe_subscription_id: null,
      status: 'trialing',
      plan: 'trial',
    });
    const paid = row({
      id: 'paid',
      stripe_customer_id: 'cus_abc',
      stripe_subscription_id: 'sub_abc',
      status: 'active',
      plan: 'pro',
    });
    expect(pickBestSubscription([trial, paid])?.id).toBe('paid');
  });
});
