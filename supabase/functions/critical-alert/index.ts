import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { smsIsOptedOut } from '../_shared/sms-send-gate.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

type Channel = 'sms' | 'whatsapp' | 'email' | 'voice';

type CriticalSettings = {
  sms_offsets: number[];
  whatsapp_offsets: number[];
  email_offsets: number[];
  voice_enabled: boolean;
  voice_offsets: number[];
};

const DEFAULT_SETTINGS: CriticalSettings = {
  sms_offsets: [-60, -15],
  whatsapp_offsets: [-60, -15],
  email_offsets: [-1440, -240],
  voice_enabled: false,
  voice_offsets: [-5, -1],
};

function normalizeSettings(raw: unknown): CriticalSettings {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_SETTINGS };
  const o = raw as Record<string, unknown>;
  const arr = (v: unknown, fb: number[]) => {
    if (!Array.isArray(v)) return [...fb];
    const nums = v.map((n) => Number(n)).filter((n) => Number.isFinite(n) && n < 0).map(Math.round);
    return nums.length ? nums.slice(0, 4) : [...fb];
  };
  return {
    sms_offsets: arr(o.sms_offsets, DEFAULT_SETTINGS.sms_offsets),
    whatsapp_offsets: arr(o.whatsapp_offsets, DEFAULT_SETTINGS.whatsapp_offsets),
    email_offsets: arr(o.email_offsets, DEFAULT_SETTINGS.email_offsets),
    voice_enabled: o.voice_enabled === true,
    voice_offsets: arr(o.voice_offsets, DEFAULT_SETTINGS.voice_offsets),
  };
}

function dispatchKey(channel: Channel, offset: number): string {
  return `${channel}:${offset}`;
}

function formatLead(minutesAbs: number): string {
  if (minutesAbs < 60) return `${minutesAbs} minute${minutesAbs === 1 ? '' : 's'}`;
  if (minutesAbs < 1440) {
    const h = Math.round(minutesAbs / 60);
    return `${h} hour${h === 1 ? '' : 's'}`;
  }
  const d = Math.round(minutesAbs / 1440);
  return `${d} day${d === 1 ? '' : 's'}`;
}

function jsonResponse(body: object, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function twilioAuth(): Promise<{ sid: string; token: string; from: string } | null> {
  const sid = Deno.env.get('TWILIO_ACCOUNT_SID');
  const token = Deno.env.get('TWILIO_AUTH_TOKEN');
  const from = Deno.env.get('TWILIO_PHONE_NUMBER');
  if (!sid || !token || !from) return null;
  return { sid, token, from };
}

async function makeTwilioCall(to: string, twiml: string): Promise<{ ok: boolean; error?: string }> {
  const auth = await twilioAuth();
  if (!auth) return { ok: false, error: 'Twilio credentials not configured' };
  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${auth.sid}/Calls.json`,
      {
        method: 'POST',
        headers: {
          Authorization: 'Basic ' + btoa(`${auth.sid}:${auth.token}`),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ From: auth.from, To: to, Twiml: twiml }),
      },
    );
    if (!res.ok) return { ok: false, error: await res.text() };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

async function sendTwilioSms(to: string, body: string): Promise<{ ok: boolean; error?: string }> {
  const auth = await twilioAuth();
  if (!auth) return { ok: false, error: 'Twilio credentials not configured' };
  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${auth.sid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: 'Basic ' + btoa(`${auth.sid}:${auth.token}`),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ From: auth.from, To: to, Body: body }),
      },
    );
    if (!res.ok) return { ok: false, error: await res.text() };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

async function sendTwilioWhatsapp(to: string, body: string): Promise<{ ok: boolean; error?: string }> {
  const auth = await twilioAuth();
  const waFromRaw = (Deno.env.get('TWILIO_WHATSAPP_NUMBER') || Deno.env.get('TWILIO_WHATSAPP_FROM') || '').trim();
  if (!auth || !waFromRaw) return { ok: false, error: 'WhatsApp not configured' };
  const waFrom = waFromRaw.startsWith('whatsapp:') ? waFromRaw : `whatsapp:${waFromRaw}`;
  const waTo = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;
  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${auth.sid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: 'Basic ' + btoa(`${auth.sid}:${auth.token}`),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ From: waFrom, To: waTo, Body: body }),
      },
    );
    if (!res.ok) return { ok: false, error: await res.text() };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

async function sendResendEmail(to: string, subject: string, text: string): Promise<{ ok: boolean; error?: string }> {
  const key = Deno.env.get('RESEND_API_KEY');
  if (!key) return { ok: false, error: 'email not configured' };
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: Deno.env.get('RESEND_FROM_EMAIL') || 'PinOnIt <alerts@pinonit.com>',
        to: [to],
        subject,
        text,
      }),
    });
    if (!res.ok) return { ok: false, error: await res.text() };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

function buildTwiml(minutesAbs: number, title: string, guestName: string, startTime: string): string {
  const timeStr = new Date(startTime).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'UTC',
  });
  const msg = `Attention. You have a critical meeting starting in ${formatLead(minutesAbs)}. Your meeting titled ${title} with ${guestName} begins at ${timeStr}. This is your PinOnIt critical meeting alert.`;
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="alice">${msg}</Say></Response>`;
}

function textBody(minutesAbs: number, title: string, guestName: string, startTime: string): string {
  const when = new Date(startTime).toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
  return `Critical meeting in ${formatLead(minutesAbs)}: ${title} with ${guestName} (${when}). — PinOnIt`;
}

const WINDOW_SLACK_MS = 90_000; // ±1.5 minutes around each offset fire time

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const now = Date.now();
    // Look ahead far enough for 2-day offsets, plus slack
    const horizonMs = 2 * 24 * 60 * 60 * 1000 + WINDOW_SLACK_MS;
    const horizonEnd = new Date(now + horizonMs).toISOString();
    const horizonStart = new Date(now - WINDOW_SLACK_MS).toISOString();

    const { data: bookings, error } = await supabase
      .from('bookings')
      .select(
        'id, start_time, guest_name, guest_email, critical_alerts_sent, critical_alert_sent_5m, critical_alert_sent_1m, profiles(id, full_name, email, notification_email, phone, whatsapp_number, critical_alert_phone, critical_alerts_enabled, critical_alert_settings), services(name)',
      )
      .eq('is_critical', true)
      .eq('status', 'confirmed')
      .gte('start_time', horizonStart)
      .lte('start_time', horizonEnd);

    if (error) return jsonResponse({ error: error.message }, 500);

    const results: { booking_id: string; sent: string[]; errors: string[] }[] = [];

    for (const booking of bookings ?? []) {
      const host = booking.profiles as Record<string, unknown> | null;
      if (!host) continue;
      if ((host.critical_alerts_enabled as boolean) === false) continue;

      const settings = normalizeSettings(host.critical_alert_settings);
      const startMs = new Date(booking.start_time as string).getTime();
      const minutesUntil = Math.round((startMs - now) / 60_000);
      const title = ((booking.services as Record<string, unknown> | null)?.name as string) || 'Meeting';
      const guestName = (booking.guest_name as string) || 'your guest';
      const startTime = booking.start_time as string;

      const already = new Set<string>(
        Array.isArray(booking.critical_alerts_sent)
          ? (booking.critical_alerts_sent as string[])
          : [],
      );
      // Legacy voice flags
      if (booking.critical_alert_sent_5m) already.add('voice:-5');
      if (booking.critical_alert_sent_1m) already.add('voice:-1');

      const hostPhone =
        ((host.phone as string | null) || (host.critical_alert_phone as string | null) || '').trim();
      const hostWhatsapp = ((host.whatsapp_number as string | null) || hostPhone || '').trim();
      const hostEmail = (
        (host.notification_email as string | null) ||
        (host.email as string | null) ||
        ''
      ).trim();

      const plan: { channel: Channel; offset: number }[] = [];
      for (const offset of settings.sms_offsets) plan.push({ channel: 'sms', offset });
      for (const offset of settings.whatsapp_offsets) plan.push({ channel: 'whatsapp', offset });
      for (const offset of settings.email_offsets) plan.push({ channel: 'email', offset });
      if (settings.voice_enabled) {
        for (const offset of settings.voice_offsets) plan.push({ channel: 'voice', offset });
      }

      const sentKeys: string[] = [];
      const errors: string[] = [];

      for (const item of plan) {
        const key = dispatchKey(item.channel, item.offset);
        if (already.has(key)) continue;

        const targetMinutes = Math.abs(item.offset);
        // Fire when we're within ±1.5 min of the offset (cron typically every minute)
        if (Math.abs(minutesUntil - targetMinutes) > 1) continue;

        const leadAbs = targetMinutes;
        const body = textBody(leadAbs, title, guestName, startTime);
        let ok = false;
        let err: string | undefined;

        if (item.channel === 'sms') {
          if (!hostPhone) {
            err = 'no phone';
          } else if (await smsIsOptedOut(supabase, hostPhone)) {
            err = 'recipient opted out (STOP)';
          } else {
            const r = await sendTwilioSms(hostPhone, body);
            ok = r.ok;
            err = r.error;
          }
        } else if (item.channel === 'whatsapp') {
          if (!hostWhatsapp) {
            err = 'no whatsapp';
          } else if (await smsIsOptedOut(supabase, hostWhatsapp)) {
            err = 'recipient opted out (STOP)';
          } else {
            const r = await sendTwilioWhatsapp(hostWhatsapp, body);
            ok = r.ok;
            err = r.error;
          }
        } else if (item.channel === 'email') {
          if (!hostEmail) {
            err = 'no email';
          } else {
            const r = await sendResendEmail(
              hostEmail,
              `Critical meeting in ${formatLead(leadAbs)}`,
              body,
            );
            ok = r.ok;
            err = r.error;
          }
        } else if (item.channel === 'voice') {
          if (!hostPhone) {
            err = 'no phone';
          } else {
            const twiml = buildTwiml(leadAbs, title, guestName, startTime);
            const r = await makeTwilioCall(hostPhone, twiml);
            ok = r.ok;
            err = r.error;
          }
        }

        // Mark sent even on soft failures so we don't spam retries every minute
        sentKeys.push(key);
        already.add(key);
        if (!ok && err) errors.push(`${key}: ${err}`);
      }

      if (sentKeys.length > 0) {
        const merged = Array.from(already);
        const patch: Record<string, unknown> = { critical_alerts_sent: merged };
        if (sentKeys.includes('voice:-5')) patch.critical_alert_sent_5m = true;
        if (sentKeys.includes('voice:-1')) patch.critical_alert_sent_1m = true;
        await supabase.from('bookings').update(patch).eq('id', booking.id as string);
      }

      if (sentKeys.length > 0 || errors.length > 0) {
        results.push({ booking_id: booking.id as string, sent: sentKeys, errors });
      }
    }

    return jsonResponse({ success: true, processed: results.length, results });
  } catch (err) {
    return jsonResponse({ error: (err as Error).message }, 500);
  }
});
