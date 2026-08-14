import Stripe from 'npm:stripe@17.7.0';
import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import {
  applyStripeSubscription,
  findPaidStripeSubscription,
  isRealStripeCustomerId,
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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing auth header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!);

    const { data: existingSub } = await supabase
      .from('subscriptions')
      .select('stripe_customer_id, stripe_subscription_id')
      .eq('user_id', user.id)
      .maybeSingle();

    let customerId = isRealStripeCustomerId(existingSub?.stripe_customer_id)
      ? existingSub!.stripe_customer_id
      : null;

    if (!customerId && user.email) {
      const found = await stripe.customers.list({ email: user.email, limit: 10 });
      const withMeta = found.data.find((c) => c.metadata?.supabase_user_id === user.id);
      customerId = withMeta?.id ?? found.data[0]?.id ?? null;
    }

    if (!customerId) {
      return new Response(JSON.stringify({ synced: false, plan: 'free', reason: 'no_stripe_customer' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    await stripe.customers.update(customerId, {
      metadata: { supabase_user_id: user.id },
    });

    let subscription: Stripe.Subscription | null = null;
    if (existingSub?.stripe_subscription_id) {
      try {
        subscription = await stripe.subscriptions.retrieve(existingSub.stripe_subscription_id, {
          expand: ['items.data.price'],
        });
      } catch {
        subscription = null;
      }
    }
    if (!subscription || subscription.status === 'canceled' || subscription.status === 'incomplete_expired') {
      subscription = await findPaidStripeSubscription(stripe, customerId);
    }

    if (!subscription) {
      await supabase.from('subscriptions').upsert({
        user_id: user.id,
        stripe_customer_id: customerId,
        plan: 'free',
        status: 'canceled',
      }, { onConflict: 'user_id' });
      return new Response(JSON.stringify({ synced: true, plan: 'free', reason: 'no_live_subscription' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const result = await applyStripeSubscription({
      supabase,
      userId: user.id,
      customerId,
      subscription,
    });

    return new Response(JSON.stringify({ synced: true, ...result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
