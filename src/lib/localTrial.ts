import { supabase } from './supabase';
import { isRealStripeCustomerId } from './stripeIds';

/** Skip local/fake Pro trials once the user already has a Stripe customer or subscription. */
export async function hasStripeBilling(userId: string): Promise<boolean> {
  const { data } = await supabase
    .from('subscriptions')
    .select('stripe_customer_id, stripe_subscription_id, plan, status')
    .eq('user_id', userId);

  return (data ?? []).some(
    (row) =>
      Boolean(row.stripe_subscription_id) ||
      isRealStripeCustomerId(row.stripe_customer_id) ||
      (row.plan !== 'free' && row.status === 'active'),
  );
}
