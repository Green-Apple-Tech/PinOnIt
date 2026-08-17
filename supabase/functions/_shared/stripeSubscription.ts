import Stripe from 'npm:stripe@17.7.0';
import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

export type AdminClient = ReturnType<typeof createClient>;

export const PLAN_MAP: Record<string, 'pro' | 'enterprise'> = {
  price_1TZHhhIVv38UYFOXMXT2EV8v: 'pro',
  price_pro_monthly: 'pro',
  price_enterprise_monthly: 'enterprise',
};

export function isAllowedCheckoutPriceId(priceId: string): boolean {
  if (PLAN_MAP[priceId]) return true;
  const envPrice = Deno.env.get('STRIPE_PRICE_ID') ?? '';
  return Boolean(envPrice) && priceId === envPrice;
}

export function isRealStripeCustomerId(id: string | null | undefined): boolean {
  return typeof id === 'string' && id.startsWith('cus_');
}

export function periodEndIso(subscription: Stripe.Subscription): string | null {
  const item = subscription.items?.data?.[0] as { current_period_end?: number } | undefined;
  const end =
    (subscription as Stripe.Subscription & { current_period_end?: number }).current_period_end ??
    item?.current_period_end;
  if (typeof end !== 'number' || !Number.isFinite(end)) return null;
  const d = new Date(end * 1000);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function planFromStripe(priceId: string | undefined, status: string): 'free' | 'pro' | 'enterprise' {
  if (priceId && PLAN_MAP[priceId]) return PLAN_MAP[priceId];
  // Paid/trialing Stripe subscriptions are Pro even if the price ID is new/unknown.
  // Never default a live subscription to Free — that is what left paying customers on Free.
  if (status === 'active' || status === 'trialing' || status === 'past_due') return 'pro';
  return 'free';
}

export function dbStatusFromStripe(subscription: Stripe.Subscription): string {
  if (subscription.status === 'trialing') return 'trialing';
  if (subscription.status === 'active') return 'active';
  if (subscription.status === 'past_due') return 'past_due';
  if (subscription.status === 'canceled' || subscription.status === 'unpaid' || subscription.status === 'incomplete_expired') {
    return 'canceled';
  }
  return subscription.status;
}

export async function resolveUserId(opts: {
  supabase: AdminClient;
  stripe: Stripe;
  customerId?: string | null;
  clientReferenceId?: string | null;
  metadataUserId?: string | null;
  email?: string | null;
}): Promise<string | null> {
  const { supabase, stripe, customerId, clientReferenceId, metadataUserId, email } = opts;
  if (clientReferenceId) return clientReferenceId;
  if (metadataUserId) return metadataUserId;

  if (isRealStripeCustomerId(customerId ?? null)) {
    const customer = await stripe.customers.retrieve(customerId!);
    if (!customer.deleted) {
      const fromMeta = (customer as Stripe.Customer).metadata?.supabase_user_id;
      if (fromMeta) return fromMeta;
    }

    const { data: byCustomer } = await supabase
      .from('subscriptions')
      .select('user_id')
      .eq('stripe_customer_id', customerId)
      .maybeSingle();
    if (byCustomer?.user_id) return byCustomer.user_id;
  }

  if (email) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .ilike('email', email)
      .maybeSingle();
    if (profile?.id) return profile.id;
  }

  return null;
}

export async function applyStripeSubscription(opts: {
  supabase: AdminClient;
  userId: string;
  customerId: string;
  subscription: Stripe.Subscription;
}): Promise<{ plan: string; status: string }> {
  const { supabase, userId, customerId, subscription } = opts;
  const priceId = subscription.items.data[0]?.price?.id;
  const stripeStatus = subscription.status;
  const plan = stripeStatus === 'canceled' || stripeStatus === 'unpaid' || stripeStatus === 'incomplete_expired'
    ? 'free'
    : planFromStripe(priceId, stripeStatus);
  const status = dbStatusFromStripe(subscription);
  const trialEnd = subscription.trial_end
    ? new Date(subscription.trial_end * 1000).toISOString()
    : null;
  const periodEnd = periodEndIso(subscription);

  const row: Record<string, unknown> = {
    user_id: userId,
    stripe_customer_id: customerId,
    stripe_subscription_id: subscription.id,
    stripe_price_id: priceId ?? null,
    stripe_current_period_end: periodEnd,
    plan,
    status,
  };
  if (trialEnd) row.trial_ends_at = trialEnd;

  const { error } = await supabase.from('subscriptions').upsert(row, { onConflict: 'user_id' });
  if (error) {
    // Fallback if unique(user_id) is not yet applied: update then insert.
    const { data: existingRows } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('user_id', userId);
    const existing = existingRows?.[0];
    if (existing?.id) {
      const { error: updErr } = await supabase.from('subscriptions').update(row).eq('id', existing.id);
      if (updErr) throw updErr;
    } else {
      const { error: insErr } = await supabase.from('subscriptions').insert(row);
      if (insErr) throw insErr;
    }
  }

  const profilePlan = plan === 'enterprise' ? 'pro' : plan;
  await supabase.from('profiles').update({ plan: profilePlan }).eq('id', userId);
  return { plan: profilePlan, status };
}

export function isLiveStripeStatus(status: string): boolean {
  return status === 'active' || status === 'trialing' || status === 'past_due';
}

export async function findPaidStripeSubscription(
  stripe: Stripe,
  customerId: string
): Promise<Stripe.Subscription | null> {
  const list = await stripe.subscriptions.list({
    customer: customerId,
    status: 'all',
    limit: 10,
    expand: ['data.items.data.price'],
  });
  const live = list.data.find((s) => isLiveStripeStatus(s.status));
  return live ?? list.data[0] ?? null;
}

export async function findPaidSubscriptionForEmail(
  stripe: Stripe,
  email: string,
  preferredUserId?: string | null,
): Promise<{ customerId: string; subscription: Stripe.Subscription } | null> {
  const found = await stripe.customers.list({ email, limit: 20 });
  const ranked = [...found.data].sort((a, b) => {
    const aMeta = a.metadata?.supabase_user_id === preferredUserId ? 1 : 0;
    const bMeta = b.metadata?.supabase_user_id === preferredUserId ? 1 : 0;
    return bMeta - aMeta;
  });
  for (const customer of ranked) {
    const subscription = await findPaidStripeSubscription(stripe, customer.id);
    if (subscription && isLiveStripeStatus(subscription.status)) {
      return { customerId: customer.id, subscription };
    }
  }
  return null;
}
