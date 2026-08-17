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
    const { currency = 'usd', service_id, host_id, guest_email, guest_name } = await req.json();

    if (!service_id || typeof service_id !== 'string') {
      return new Response(JSON.stringify({ error: 'Missing service_id' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: service } = await supabase
      .from('services')
      .select('id, host_id, price_cents, is_active')
      .eq('id', service_id)
      .maybeSingle();

    if (!service || !service.is_active) {
      return new Response(JSON.stringify({ error: 'Service not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (host_id && host_id !== service.host_id) {
      return new Response(JSON.stringify({ error: 'Host mismatch' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const amount = Number(service.price_cents);
    if (!Number.isFinite(amount) || amount < 50) {
      return new Response(JSON.stringify({ error: 'Invalid amount' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeKey) {
      return new Response(JSON.stringify({ error: 'Stripe is not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const stripe = new Stripe(stripeKey);
    const intent = await stripe.paymentIntents.create({
      amount,
      currency: String(currency).toLowerCase(),
      automatic_payment_methods: { enabled: true },
      metadata: {
        service_id: service.id,
        host_id: service.host_id,
        guest_email: guest_email ?? '',
        guest_name: guest_name ?? '',
      },
    });

    return new Response(JSON.stringify({ clientSecret: intent.client_secret }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message ?? 'Payment setup failed' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
