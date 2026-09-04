/**
 * Pure plan resolution used by the app and edge functions.
 * Postgres `host_plan_is_active` is a separate copy used by RLS — keep those
 * rules aligned when changing this file.
 */

export type PlanTier = 'trial' | 'pro' | 'expired';

export type ProfilePlanRow = {
  plan?: string | null;
  plan_override?: 'pro' | null;
};

export type SubscriptionPlanRow = {
  plan?: string | null;
  status?: string | null;
  trial_ends_at?: string | null;
  stripe_current_period_end?: string | null;
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  updated_at?: string | null;
};

export function isComplimentaryPro(profile?: ProfilePlanRow | null): boolean {
  return profile?.plan_override === 'pro';
}

export function isActivePlan(plan: PlanTier): boolean {
  return plan === 'trial' || plan === 'pro';
}

function localTrialExpired(trialEndsAt?: string | null): boolean {
  if (!trialEndsAt) return false;
  return new Date(trialEndsAt).getTime() <= Date.now();
}

export function effectivePlan(
  subscription?: SubscriptionPlanRow | null,
  profile?: ProfilePlanRow | null,
): PlanTier {
  if (isComplimentaryPro(profile)) return 'pro';

  if (subscription?.status === 'trialing' || subscription?.plan === 'trial') {
    if (localTrialExpired(subscription.trial_ends_at)) return 'expired';
    return 'trial';
  }

  if (subscription?.status === 'active' || subscription?.status === 'past_due') {
    if (subscription.plan === 'pro') return 'pro';
  }

  if (subscription?.status === 'canceled') {
    const periodEnd = subscription.stripe_current_period_end
      ? new Date(subscription.stripe_current_period_end).getTime()
      : 0;
    if (subscription.plan === 'pro' && periodEnd > Date.now()) return 'pro';
    return 'expired';
  }

  if (subscription?.plan === 'expired') return 'expired';
  if (profile?.plan === 'trial') {
    if (localTrialExpired(subscription?.trial_ends_at)) return 'expired';
    return 'trial';
  }
  if (profile?.plan === 'pro') return 'pro';
  if (profile?.plan === 'expired') return 'expired';

  return 'expired';
}

function subscriptionScore(row: SubscriptionPlanRow): number {
  let score = 0;
  if (row.stripe_subscription_id) score += 8;
  if (typeof row.stripe_customer_id === 'string' && row.stripe_customer_id.startsWith('cus_')) score += 4;
  if (row.plan === 'pro') score += 4;
  else if (row.plan === 'trial') score += 3;
  if (row.status === 'active') score += 3;
  else if (row.status === 'trialing' || row.status === 'past_due') score += 2;
  return score;
}

export function pickBestSubscription(
  rows: SubscriptionPlanRow[] | null | undefined,
): SubscriptionPlanRow | null {
  if (!rows?.length) return null;
  return [...rows].sort((a, b) => {
    const diff = subscriptionScore(b) - subscriptionScore(a);
    if (diff !== 0) return diff;
    const aTs = a.updated_at ? new Date(a.updated_at).getTime() : 0;
    const bTs = b.updated_at ? new Date(b.updated_at).getTime() : 0;
    return bTs - aTs;
  })[0];
}

export function hostRowIsActive(
  profile: ProfilePlanRow & { id?: string },
  subscriptions: SubscriptionPlanRow[] | null | undefined,
): boolean {
  const sub = pickBestSubscription(subscriptions ?? []);
  return isActivePlan(effectivePlan(sub, profile));
}
