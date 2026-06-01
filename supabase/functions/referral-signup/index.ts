import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

/**
 * Called after a new user signs up with a referral code.
 * Records the referral relationship.
 * Body: { referral_code: string }
 */
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
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { referral_code } = await req.json();
    if (!referral_code) {
      return new Response(JSON.stringify({ error: 'Missing referral_code' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Find referrer by code
    const { data: referrer } = await supabase
      .from('profiles')
      .select('id')
      .eq('referral_code', referral_code)
      .maybeSingle();

    if (!referrer) {
      return new Response(JSON.stringify({ error: 'Invalid referral code' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Don't allow self-referral
    if (referrer.id === user.id) {
      return new Response(JSON.stringify({ ok: true, message: 'Self-referral ignored' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if this user was already referred
    const { data: existing } = await supabase
      .from('referrals')
      .select('id')
      .eq('referred_user_id', user.id)
      .maybeSingle();

    if (existing) {
      return new Response(JSON.stringify({ ok: true, message: 'Already tracked' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Insert referral record
    await supabase.from('referrals').insert({
      referrer_id: referrer.id,
      referred_user_id: user.id,
      referred_email: user.email,
      status: 'signed_up',
    });

    // Record on the referred user's profile who referred them
    await supabase
      .from('profiles')
      .update({ referred_by: referral_code })
      .eq('id', user.id);

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
