import Stripe from 'npm:stripe@17.7.0';
import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

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

    // Resolve price ID — if it's a placeholder (not starting with 'price_'), look up the first active price
    let resolvedPriceId = price_id;
    if (!price_id.startsWith('price_')) {
      const prices = await stripe.prices.list({ active: true, limit: 10, expand: ['data.product'] });
      if (prices.data.length === 0) {
        return new Response(JSON.stringify({ error: 'No active prices found in Stripe. Please create a price in your Stripe dashboard.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      // Pick the first recurring price
      const recurring = prices.data.find((p) => p.recurring != null);
      resolvedPriceId = (recurring ?? prices.data[0]).id;
    }

    // Check if customer exists
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .maybeSingle();

    let customerId = subscription?.stripe_customer_id;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email!,
        metadata: { supabase_user_id: user.id },
      });
      customerId = customer.id;

      await supabase.from('subscriptions').upsert({
        user_id: user.id,
        stripe_customer_id: customerId,
        plan: 'free',
        status: 'active',
      }, { onConflict: 'user_id' });
    }

    const trialDays = trial_period_days ? Number(trial_period_days) : 0;
    const stepParam = wizard_step ? `&wizard_step=${wizard_step}` : '';
    const trialParam = trialDays > 0 ? `&trial_days=${trialDays}` : '';

    const sessionParams: Parameters<typeof stripe.checkout.sessions.create>[0] = {
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: resolvedPriceId, quantity: 1 }],
      success_url: `${origin}/dashboard?checkout=success${stepParam}${trialParam}`,
      cancel_url: `${origin}/dashboard/billing?checkout=cancelled`,
      payment_method_collection: 'always',
    };

    if (trialDays > 0) {
      sessionParams.subscription_data = {
        trial_period_days: trialDays,
      };
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
