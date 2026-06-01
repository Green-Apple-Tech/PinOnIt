import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

async function makeTwilioCall(to: string, twiml: string): Promise<{ ok: boolean; error?: string }> {
  const twilioSid = Deno.env.get('TWILIO_ACCOUNT_SID');
  const twilioToken = Deno.env.get('TWILIO_AUTH_TOKEN');
  const twilioFrom = Deno.env.get('TWILIO_PHONE_NUMBER');
  if (!twilioSid || !twilioToken || !twilioFrom) {
    return { ok: false, error: 'Twilio credentials not configured' };
  }
  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Calls.json`,
      {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + btoa(`${twilioSid}:${twilioToken}`),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ From: twilioFrom, To: to, Twiml: twiml }),
      }
    );
    if (!res.ok) return { ok: false, error: await res.text() };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

function buildTwiml(minutes: number, title: string, guestName: string, startTime: string): string {
  const timeStr = new Date(startTime).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'UTC',
  });
  const msg = `Attention. You have a critical meeting starting in ${minutes} minute${minutes !== 1 ? 's' : ''}. Your meeting titled ${title} with ${guestName} begins at ${timeStr}. This is your PinOnIt critical meeting alert.`;
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="alice">${msg}</Say></Response>`;
}

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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const now = new Date();

    const window5mStart = new Date(now.getTime() + 4 * 60 * 1000).toISOString();
    const window5mEnd   = new Date(now.getTime() + 6 * 60 * 1000).toISOString();
    const window1mStart = new Date(now.getTime() + 0 * 60 * 1000).toISOString();
    const window1mEnd   = new Date(now.getTime() + 2 * 60 * 1000).toISOString();

    const { data: bookings5m } = await supabase
      .from('bookings')
      .select('*, profiles(id, full_name, critical_alert_phone, critical_alerts_enabled), services(name)')
      .eq('is_critical', true)
      .eq('critical_alert_sent_5m', false)
      .eq('status', 'confirmed')
      .gte('start_time', window5mStart)
      .lte('start_time', window5mEnd);

    const { data: bookings1m } = await supabase
      .from('bookings')
      .select('*, profiles(id, full_name, critical_alert_phone, critical_alerts_enabled), services(name)')
      .eq('is_critical', true)
      .eq('critical_alert_sent_1m', false)
      .eq('status', 'confirmed')
      .gte('start_time', window1mStart)
      .lte('start_time', window1mEnd);

    const results: { booking_id: string; minutes: number; called: string[]; errors: string[] }[] = [];

    const processBooking = async (booking: Record<string, unknown>, minutes: 5 | 1) => {
      const host = booking.profiles as Record<string, unknown>;
      const alertsEnabled = (host?.critical_alerts_enabled as boolean) !== false;
      const hostPhone = host?.critical_alert_phone as string | null;
      const serviceName = ((booking.services as Record<string, unknown>)?.name as string) ?? 'Meeting';
      const guestName = booking.guest_name as string;
      const startTime = booking.start_time as string;

      const called: string[] = [];
      const errors: string[] = [];

      if (alertsEnabled && hostPhone) {
        const twiml = buildTwiml(minutes, serviceName, guestName, startTime);
        const r = await makeTwilioCall(hostPhone, twiml);
        if (r.ok) called.push(`host:${hostPhone}`);
        else errors.push(`host call failed: ${r.error}`);
      }

      const updateField = minutes === 5 ? { critical_alert_sent_5m: true } : { critical_alert_sent_1m: true };
      await supabase.from('bookings').update(updateField).eq('id', booking.id as string);

      results.push({ booking_id: booking.id as string, minutes, called, errors });
    };

    await Promise.all([
      ...(bookings5m ?? []).map(b => processBooking(b as Record<string, unknown>, 5)),
      ...(bookings1m ?? []).map(b => processBooking(b as Record<string, unknown>, 1)),
    ]);

    return jsonResponse({ success: true, processed: results.length, results });
  } catch (err) {
    return jsonResponse({ error: (err as Error).message }, 500);
  }
});
