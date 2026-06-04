import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatTimeUntil(minutesUntil: number): string {
  if (minutesUntil <= 0) return 'a moment';
  if (minutesUntil < 60) return `${minutesUntil} minute${minutesUntil === 1 ? '' : 's'}`;
  const hours = Math.round(minutesUntil / 60);
  return `${hours} hour${hours === 1 ? '' : 's'}`;
}

function buildPinOnItVoiceTwiml(timeUntil: string): string {
  const line = `This is a reminder from PinOnIt. You have a booking in ${timeUntil}.`;
  const safe = escapeXml(line);
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">${safe}</Say>
  <Pause length="1"/>
  <Say voice="Polly.Joanna">${safe}</Say>
</Response>`;
}

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
          Authorization: 'Basic ' + btoa(`${twilioSid}:${twilioToken}`),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ From: twilioFrom, To: to, Twiml: twiml }),
      },
    );
    if (!res.ok) return { ok: false, error: await res.text() };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
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
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const now = new Date();
    const in60 = new Date(now.getTime() + 60 * 60 * 1000);

    const { data: bookings, error: queryError } = await supabase
      .from('bookings')
      .select('id, start_time, host_id, profiles!inner(voice_reminder_enabled, phone, critical_alert_phone)')
      .eq('status', 'confirmed')
      .eq('voice_reminder_sent', false)
      .eq('profiles.voice_reminder_enabled', true)
      .gte('start_time', now.toISOString())
      .lte('start_time', in60.toISOString());

    if (queryError) {
      console.error('voice-reminder-scheduler query error:', queryError);
      return jsonResponse({ error: queryError.message }, 500);
    }

    if (!bookings?.length) {
      return jsonResponse({ success: true, processed: 0, message: 'No bookings' });
    }

    const results: {
      booking_id: string;
      called: boolean;
      phone?: string;
      minutes_until?: number;
      error?: string;
    }[] = [];

    for (const booking of bookings) {
      const profile = booking.profiles as {
        voice_reminder_enabled?: boolean;
        phone?: string | null;
        critical_alert_phone?: string | null;
      };

      if (profile?.voice_reminder_enabled !== true) continue;

      const hostPhone = profile.phone || profile.critical_alert_phone;
      if (!hostPhone) {
        results.push({ booking_id: booking.id, called: false, error: 'No host phone' });
        continue;
      }

      const startMs = new Date(booking.start_time).getTime();
      const minutesUntil = Math.max(1, Math.round((startMs - now.getTime()) / 60000));
      const timeUntil = formatTimeUntil(minutesUntil);
      const twiml = buildPinOnItVoiceTwiml(timeUntil);

      const call = await makeTwilioCall(hostPhone, twiml);
      if (!call.ok) {
        results.push({
          booking_id: booking.id,
          called: false,
          phone: hostPhone,
          minutes_until: minutesUntil,
          error: call.error,
        });
        continue;
      }

      await supabase
        .from('bookings')
        .update({ voice_reminder_sent: true })
        .eq('id', booking.id);

      results.push({
        booking_id: booking.id,
        called: true,
        phone: hostPhone,
        minutes_until: minutesUntil,
      });
    }

    return jsonResponse({
      success: true,
      processed: results.length,
      called: results.filter((r) => r.called).length,
      results,
    });
  } catch (err) {
    return jsonResponse({ error: (err as Error).message }, 500);
  }
});
