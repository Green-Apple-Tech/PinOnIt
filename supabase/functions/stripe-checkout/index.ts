import Stripe from 'npm:stripe@17.7.0';
import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { isRealStripeCustomerId } from '../_shared/stripeSubscription.ts';

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

    const { price_id, app_url, trial_period_days, wizard_step } = await req.json();
    if (!price_id) {
      return new Response(JSON.stringify({ error: 'Missing price_id' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const origin = app_url ?? 'https://pinonit.com';

    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!);

    let resolvedPriceId = price_id;
    if (!price_id.startsWith('price_')) {
      const prices = await stripe.prices.list({ active: true, limit: 10, expand: ['data.product'] });
      if (prices.data.length === 0) {
        return new Response(JSON.stringify({ error: 'No active prices found in Stripe. Please create a price in your Stripe dashboard.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const recurring = prices.data.find((p) => p.recurring != null);
      resolvedPriceId = (recurring ?? prices.data[0]).id;
    }

    const { data: existingSub } = await supabase
      .from('subscriptions')
      .select('stripe_customer_id, plan, status')
      .eq('user_id', user.id)
      .maybeSingle();

    let customerId = isRealStripeCustomerId(existingSub?.stripe_customer_id)
      ? existingSub!.stripe_customer_id
      : null;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email!,
        metadata: { supabase_user_id: user.id },
      });
      customerId = customer.id;
    } else {
      await stripe.customers.update(customerId, {
        metadata: { supabase_user_id: user.id },
      });
    }

    const { error: upsertError } = await supabase.from('subscriptions').upsert({
      user_id: user.id,
      stripe_customer_id: customerId,
    }, { onConflict: 'user_id' });
    if (upsertError) {
      console.error('stripe-checkout: failed to persist customer', upsertError);
      return new Response(JSON.stringify({ error: 'Could not save billing customer. Please try again.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const trialDays = trial_period_days ? Number(trial_period_days) : 0;
    const stepParam = wizard_step ? `&wizard_step=${wizard_step}` : '';
    const trialParam = trialDays > 0 ? `&trial_days=${trialDays}` : '';

    const sessionParams: Parameters<typeof stripe.checkout.sessions.create>[0] = {
      customer: customerId,
      client_reference_id: user.id,
      metadata: { supabase_user_id: user.id },
      mode: 'subscription',
      line_items: [{ price: resolvedPriceId, quantity: 1 }],
      success_url: wizard_step
        ? `${origin}/dashboard?checkout=success${stepParam}${trialParam}`
        : `${origin}/dashboard/settings?tab=billing&checkout=success${trialParam}`,
      cancel_url: `${origin}/dashboard/settings?tab=billing&checkout=cancelled`,
      payment_method_collection: 'always',
      subscription_data: {
        metadata: { supabase_user_id: user.id },
      },
    };

    if (trialDays > 0) {
      sessionParams.subscription_data = {
        ...sessionParams.subscription_data,
        trial_period_days: trialDays,
      };
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    return new Response(JSON.stringify({ url: session.url }), {
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
