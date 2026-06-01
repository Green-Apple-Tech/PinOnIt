import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

function jsonResponse(body: object, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const twilioSid = Deno.env.get('TWILIO_ACCOUNT_SID');
    const twilioToken = Deno.env.get('TWILIO_AUTH_TOKEN');
    const twilioFrom = Deno.env.get('TWILIO_PHONE_NUMBER');
    if (!twilioSid || !twilioToken || !twilioFrom) {
      return jsonResponse({ error: 'Twilio credentials not configured' }, 400);
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return jsonResponse({ error: 'Unauthorized' }, 401);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return jsonResponse({ error: 'Unauthorized' }, 401);

    const { data: profile } = await supabase
      .from('profiles')
      .select('phone, critical_alert_phone, critical_alerts_enabled')
      .eq('id', user.id)
      .maybeSingle();

    const toPhone = profile?.phone || profile?.critical_alert_phone;
    if (!toPhone) return jsonResponse({ error: 'No phone number configured. Add one in Settings → Profile.' }, 400);

    const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="alice">This is a test of your PinOnIt critical meeting alert system. Your voice call alerts are working correctly.</Say></Response>`;

    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Calls.json`,
      {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + btoa(`${twilioSid}:${twilioToken}`),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ From: twilioFrom, To: toPhone, Twiml: twiml }),
      }
    );

    if (!res.ok) {
      const errText = await res.text();
      return jsonResponse({ error: `Twilio error: ${errText}` }, 502);
    }

    return jsonResponse({ success: true, message: `Test call initiated to ${toPhone}` });
  } catch (err) {
    return jsonResponse({ error: (err as Error).message }, 500);
  }
});
