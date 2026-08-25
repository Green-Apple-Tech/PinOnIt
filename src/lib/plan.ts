import type { Profile, Subscription } from './types';

type PlanBits = Pick<Subscription, 'plan' | 'status'> & {
  stripe_current_period_end?: string | null;
};

type ProfilePlanBits = Pick<Profile, 'plan'> & {
  plan_override?: 'pro' | null;
};

export function isComplimentaryPro(
  profile?: Pick<Profile, 'plan_override'> | null,
): boolean {
  return profile?.plan_override === 'pro';
}

/** Plan shown in the UI. Complimentary override wins over Stripe. */
export function effectivePlan(
  subscription?: PlanBits | null,
  profile?: ProfilePlanBits | null,
): 'free' | 'pro' {
  if (isComplimentaryPro(profile)) return 'pro';
  if (subscription?.status === 'canceled') {
    const periodEnd = subscription.stripe_current_period_end
      ? new Date(subscription.stripe_current_period_end).getTime()
      : 0;
    // Paid through current period even after cancel-at-period-end was stored as canceled.
    if (subscription.plan && subscription.plan !== 'free' && periodEnd > Date.now()) {
      return 'pro';
    }
    return 'free';
  }
  if (subscription?.plan && subscription.plan !== 'free') return 'pro';
  if (profile?.plan === 'pro') return 'pro';
  return 'free';
}

function subscriptionScore(row: Subscription): number {
  let score = 0;
  if (row.stripe_subscription_id) score += 8;
  if (typeof row.stripe_customer_id === 'string' && row.stripe_customer_id.startsWith('cus_')) score += 4;
  if (row.plan && row.plan !== 'free') score += 3;
  if (row.status === 'active') score += 3;
  else if (row.status === 'trialing' || row.status === 'past_due') score += 2;
  else if (row.status === 'canceled') score += 0;
  return score;
}

/** Prefer a live Stripe-backed Pro row when duplicates exist (maybeSingle would otherwise fail). */
export function pickBestSubscription(rows: Subscription[] | null | undefined): Subscription | null {
  if (!rows?.length) return null;
  return [...rows].sort((a, b) => {
    const diff = subscriptionScore(b) - subscriptionScore(a);
    if (diff !== 0) return diff;
    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
  })[0];
}
