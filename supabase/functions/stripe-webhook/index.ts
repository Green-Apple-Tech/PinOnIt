import Stripe from 'npm:stripe@17.7.0';
import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const PLAN_MAP: Record<string, string> = {
  price_1TZHhhIVv38UYFOXMXT2EV8v: 'pro',
  price_pro_monthly: 'pro',
  price_enterprise_monthly: 'enterprise',
};

// $6/month = 600 cents. Credits above this trigger payout accumulation.
const PRO_PRICE_CENTS = 600;
// Minimum Stripe payout threshold in cents
const PAYOUT_THRESHOLD_CENTS = 1000;

async function handleConversion(
  stripe: Stripe,
  supabase: ReturnType<typeof createClient>,
  userId: string
) {
  // Find any pending referral for this user
  const { data: referral } = await supabase
    .from('referrals')
    .select('id, referrer_id, credit_applied')
    .eq('referred_user_id', userId)
    .eq('status', 'signed_up')
    .maybeSingle();

  if (!referral || referral.credit_applied) return;

  // Mark referral as converted
  await supabase
    .from('referrals')
    .update({ status: 'converted', converted_at: new Date().toISOString(), credit_applied: true })
    .eq('id', referral.id);

  // Add $1 credit to ledger
  await supabase.from('referral_credits').insert({
    user_id: referral.referrer_id,
    referral_id: referral.id,
    amount_cents: 100,
    stripe_credit_applied: false,
  });

  // Get referrer's Stripe customer ID
  const { data: referrerSub } = await supabase
    .from('subscriptions')
    .select('stripe_customer_id, stripe_subscription_id')
    .eq('user_id', referral.referrer_id)
    .maybeSingle();

  if (!referrerSub?.stripe_customer_id) return;

  // Sum total unapplied credits
  const { data: pendingCredits } = await supabase
    .from('referral_credits')
    .select('id, amount_cents')
    .eq('user_id', referral.referrer_id)
    .eq('stripe_credit_applied', false);

  if (!pendingCredits || pendingCredits.length === 0) return;

  const totalPendingCents = pendingCredits.reduce((sum, c) => sum + c.amount_cents, 0);

  // Count total converted referrals for this referrer
  const { count: convertedCount } = await supabase
    .from('referrals')
    .select('id', { count: 'exact', head: true })
    .eq('referrer_id', referral.referrer_id)
    .eq('status', 'converted');

  const totalConverted = convertedCount ?? 0;

  if (totalConverted >= 7) {
    // 7+ referrals: excess credits beyond the monthly bill go to bank payout
    // Apply credits to Stripe customer balance (negative = credit)
    await stripe.customers.createBalanceTransaction(referrerSub.stripe_customer_id, {
      amount: -totalPendingCents,
      currency: 'usd',
      description: `Referral credit: ${pendingCredits.length} referral(s) converted`,
    });

    // Check if total customer balance credit exceeds the bill enough to payout
    const customer = await stripe.customers.retrieve(referrerSub.stripe_customer_id) as Stripe.Customer;
    const balanceCredit = -(customer.balance ?? 0); // balance is negative when customer has credit
    if (balanceCredit >= PRO_PRICE_CENTS + PAYOUT_THRESHOLD_CENTS) {
      // Excess over the monthly bill — create a payout transfer if they have a connected account
      // For now we just leave the credit accumulating; payout requires Stripe Connect setup
      // which needs user bank details. We mark credits applied and note excess.
    }
  } else {
    // < 7 referrals: apply as billing credit (reduces their monthly bill)
    await stripe.customers.createBalanceTransaction(referrerSub.stripe_customer_id, {
      amount: -100, // just this new $1 credit
      currency: 'usd',
      description: 'Referral credit: 1 referral converted to Pro',
    });
  }

  // Mark all pending credits as applied
  const pendingIds = pendingCredits.map((c) => c.id);
  await supabase
    .from('referral_credits')
    .update({ stripe_credit_applied: true })
    .in('id', pendingIds);
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!);
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const body = await req.text();
    const signature = req.headers.get('stripe-signature');
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')!;

    if (!signature) {
      return new Response(JSON.stringify({ error: 'Missing stripe-signature header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const event = stripe.webhooks.constructEvent(body, signature, webhookSecret);

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const customerId = session.customer as string;
        const subscriptionId = session.subscription as string;

        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const priceId = subscription.items.data[0]?.price.id;
        const plan = PLAN_MAP[priceId] ?? 'free';

        // Determine trial end from Stripe subscription
        const trialEnd = subscription.trial_end
          ? new Date(subscription.trial_end * 1000).toISOString()
          : null;

        const subStatus = subscription.status === 'trialing' ? 'trialing' : 'active';

        await supabase
          .from('subscriptions')
          .update({
            stripe_subscription_id: subscriptionId,
            stripe_price_id: priceId,
            stripe_current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
            plan,
            status: subStatus,
            ...(trialEnd ? { trial_ends_at: trialEnd } : {}),
          })
          .eq('stripe_customer_id', customerId);

        const { data: sub } = await supabase
          .from('subscriptions')
          .select('user_id')
          .eq('stripe_customer_id', customerId)
          .maybeSingle();

        if (sub) {
          await supabase.from('profiles').update({ plan }).eq('id', sub.user_id);
          if (plan === 'pro') {
            await handleConversion(stripe, supabase, sub.user_id);
          }
        }
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        const priceId = subscription.items.data[0]?.price.id;
        const plan = PLAN_MAP[priceId] ?? 'free';

        await supabase
          .from('subscriptions')
          .update({
            stripe_price_id: priceId,
            stripe_current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
            plan,
            status: subscription.status === 'active' ? 'active' : subscription.cancel_at_period_end ? 'canceled' : subscription.status,
          })
          .eq('stripe_subscription_id', subscription.id);

        const { data: sub } = await supabase
          .from('subscriptions')
          .select('user_id')
          .eq('stripe_subscription_id', subscription.id)
          .maybeSingle();

        if (sub) {
          await supabase.from('profiles').update({ plan }).eq('id', sub.user_id);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object;

        const { data: sub } = await supabase
          .from('subscriptions')
          .select('user_id')
          .eq('stripe_subscription_id', subscription.id)
          .maybeSingle();

        await supabase
          .from('subscriptions')
          .update({ plan: 'free', status: 'canceled', stripe_subscription_id: null, stripe_price_id: null })
          .eq('stripe_subscription_id', subscription.id);

        if (sub) {
          await supabase.from('profiles').update({ plan: 'free' }).eq('id', sub.user_id);
        }
        break;
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
