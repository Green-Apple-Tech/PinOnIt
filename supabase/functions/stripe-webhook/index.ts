import Stripe from 'npm:stripe@17.7.0';
import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import {
  applyStripeSubscription,
  isRealStripeCustomerId,
  resolveUserId,
  writeProfilePlanFromStripe,
} from '../_shared/stripeSubscription.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

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
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');

    if (!webhookSecret) {
      console.error('stripe-webhook: STRIPE_WEBHOOK_SECRET is not set');
      return new Response(JSON.stringify({ error: 'Webhook secret not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!signature) {
      return new Response(JSON.stringify({ error: 'Missing stripe-signature header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Deno/Web Crypto requires the async verifier (sync constructEvent always 400s).
    const event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);

    const syncFromSubscription = async (
      subscription: Stripe.Subscription,
      extras?: {
        clientReferenceId?: string | null;
        metadataUserId?: string | null;
        email?: string | null;
        applyReferral?: boolean;
      }
    ) => {
      const customerId = typeof subscription.customer === 'string'
        ? subscription.customer
        : subscription.customer?.id;
      if (!customerId) return;

      const userId = await resolveUserId({
        supabase,
        stripe,
        customerId,
        clientReferenceId: extras?.clientReferenceId,
        metadataUserId: extras?.metadataUserId ?? subscription.metadata?.supabase_user_id,
        email: extras?.email,
      });
      if (!userId) {
        console.error('stripe-webhook: could not resolve user for subscription', subscription.id);
        return;
      }

      const { plan } = await applyStripeSubscription({
        supabase,
        userId,
        customerId,
        subscription,
      });

      if (
        extras?.applyReferral &&
        plan === 'pro' &&
        (subscription.status === 'active' || subscription.status === 'trialing')
      ) {
        await handleConversion(stripe, supabase, userId);
      }
    };

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const subscriptionId = typeof session.subscription === 'string'
          ? session.subscription
          : session.subscription?.id;

        if (!subscriptionId) {
          console.error('stripe-webhook: checkout.session.completed missing subscription', session.id);
          break;
        }

        const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
          expand: ['items.data.price'],
        });
        const email = session.customer_details?.email ?? session.customer_email;
        await syncFromSubscription(subscription, {
          clientReferenceId: session.client_reference_id,
          metadataUserId: session.metadata?.supabase_user_id,
          email,
          applyReferral: true,
        });
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        await syncFromSubscription(subscription);
        break;
      }

      case 'invoice.paid':
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice & {
          subscription?: string | { id: string } | null;
          parent?: { subscription_details?: { subscription?: string } };
        };
        const rawSub = invoice.subscription ?? invoice.parent?.subscription_details?.subscription;
        const subscriptionId = typeof rawSub === 'string' ? rawSub : rawSub?.id;
        if (!subscriptionId) break;
        const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
          expand: ['items.data.price'],
        });
        await syncFromSubscription(subscription, {
          email: invoice.customer_email,
          applyReferral: true,
        });
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = typeof subscription.customer === 'string'
          ? subscription.customer
          : subscription.customer?.id;

        const userId = await resolveUserId({
          supabase,
          stripe,
          customerId,
          metadataUserId: subscription.metadata?.supabase_user_id,
        });

        if (userId) {
          await supabase
            .from('subscriptions')
            .update({
              plan: 'expired',
              status: 'canceled',
              stripe_subscription_id: null,
              stripe_price_id: null,
            })
            .eq('user_id', userId);
          await writeProfilePlanFromStripe(supabase, userId, 'expired');
        } else if (isRealStripeCustomerId(customerId ?? null)) {
          await supabase
            .from('subscriptions')
            .update({
              plan: 'expired',
              status: 'canceled',
              stripe_subscription_id: null,
              stripe_price_id: null,
            })
            .eq('stripe_subscription_id', subscription.id);
        }
        break;
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('stripe-webhook error', message);
    // Signature / payload verification failures → 400 (Stripe should not retry forever with bad secret).
    // Unexpected processing bugs after a valid event → 200 so Stripe does not disable the endpoint.
    const isVerifyFailure =
      /signature|No signatures|Invalid signature|Webhook payload|constructEvent|SubtleCrypto/i.test(message);
    const status = isVerifyFailure ? 400 : 200;
    return new Response(JSON.stringify({ error: message, received: !isVerifyFailure }), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

const PRO_PRICE_CENTS = 899;
const PAYOUT_THRESHOLD_CENTS = 1000;

async function handleConversion(
  stripe: Stripe,
  supabase: ReturnType<typeof createClient>,
  userId: string
) {
  const { data: referral } = await supabase
    .from('referrals')
    .select('id, referrer_id, credit_applied')
    .eq('referred_user_id', userId)
    .eq('status', 'signed_up')
    .maybeSingle();

  if (!referral || referral.credit_applied) return;

  await supabase
    .from('referrals')
    .update({ status: 'converted', converted_at: new Date().toISOString(), credit_applied: true })
    .eq('id', referral.id);

  await supabase.from('referral_credits').insert({
    user_id: referral.referrer_id,
    referral_id: referral.id,
    amount_cents: 100,
    stripe_credit_applied: false,
  });

  const { data: referrerSub } = await supabase
    .from('subscriptions')
    .select('stripe_customer_id, stripe_subscription_id')
    .eq('user_id', referral.referrer_id)
    .maybeSingle();

  if (!isRealStripeCustomerId(referrerSub?.stripe_customer_id)) return;

  const { data: pendingCredits } = await supabase
    .from('referral_credits')
    .select('id, amount_cents')
    .eq('user_id', referral.referrer_id)
    .eq('stripe_credit_applied', false);

  if (!pendingCredits || pendingCredits.length === 0) return;

  const totalPendingCents = pendingCredits.reduce((sum, c) => sum + c.amount_cents, 0);

  const { count: convertedCount } = await supabase
    .from('referrals')
    .select('id', { count: 'exact', head: true })
    .eq('referrer_id', referral.referrer_id)
    .eq('status', 'converted');

  const totalConverted = convertedCount ?? 0;

  if (totalConverted >= 7) {
    await stripe.customers.createBalanceTransaction(referrerSub!.stripe_customer_id, {
      amount: -totalPendingCents,
      currency: 'usd',
      description: `Referral credit: ${pendingCredits.length} referral(s) converted`,
    });

    const customer = await stripe.customers.retrieve(referrerSub!.stripe_customer_id) as Stripe.Customer;
    const balanceCredit = -(customer.balance ?? 0);
    if (balanceCredit >= PRO_PRICE_CENTS + PAYOUT_THRESHOLD_CENTS) {
      // Excess credit accumulates until Stripe Connect payouts are wired up.
    }
  } else {
    await stripe.customers.createBalanceTransaction(referrerSub!.stripe_customer_id, {
      amount: -100,
      currency: 'usd',
      description: 'Referral credit: 1 referral converted to Pro',
    });
  }

  const pendingIds = pendingCredits.map((c) => c.id);
  await supabase
    .from('referral_credits')
    .update({ stripe_credit_applied: true })
    .in('id', pendingIds);
}
