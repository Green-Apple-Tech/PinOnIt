import type { Profile, Subscription } from './types';

/** Plan shown in the UI. Subscription is source of truth when it exists; profile is fallback. */
export function effectivePlan(
  subscription?: Pick<Subscription, 'plan' | 'status'> | null,
  profile?: Pick<Profile, 'plan'> | null,
): 'free' | 'pro' {
  if (subscription?.status === 'canceled') return 'free';
  if (subscription?.plan && subscription.plan !== 'free') return 'pro';
  if (profile?.plan === 'pro') return 'pro';
  return 'free';
}
