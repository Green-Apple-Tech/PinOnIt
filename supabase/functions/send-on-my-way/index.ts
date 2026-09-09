import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { sendTwilioSmsGuarded } from '../_shared/sms-send-gate.ts';
import { hostIdFromJwt, jsonAuthError } from '../_shared/callerAuth.ts';
import { expireStaleTrials, hostPlanIsActive } from '../_shared/hostPlan.ts';
import { bookingAllowsGuestSms } from '../_shared/sms-compliance.ts';
import { logHostSmsUsage } from '../_shared/messageLog.ts';
import { NOREPLY_FROM, SUPPORT_EMAIL } from '../_shared/contact-email.ts';
import {
  ON_MY_WAY_SMS_ENABLED,
  bumpOnMyWayEtaUsage,
  clampOnMyWayEta,
  hostFirstName,
  pickDefaultOnMyWayEta,
  renderOnMyWayMessage,
} from '../_shared/on-my-way.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function sendResendEmail(to: string, subject: string, msgBody: string): Promise<boolean> {
  const resendKey = Deno.env.get('RESEND_API_KEY');
  if (!resendKey) return false;
  const fromEmail = Deno.env.get('RESEND_FROM_EMAIL') ?? NOREPLY_FROM;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: fromEmail,
      reply_to: SUPPORT_EMAIL,
      to: [to],
      subject,
      text: msgBody,
      html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;">${
        msgBody
          .split('\n')
          .map((line) => `<p style="margin:0 0 12px">${line.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</p>`)
          .join('')
      }</div>`,
    }),
  });
  if (!res.ok) {
    console.error('On-my-way email failed:', await res.text());
    return false;
  }
  return true;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ ok: false, error: 'Method not allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  if (!supabaseUrl || !anonKey) return json({ ok: false, error: 'Server is not configured' }, 500);

  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });

  const hostId = await hostIdFromJwt(req, supabase);
  if (!hostId) return jsonAuthError(corsHeaders);

  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!serviceRoleKey) return json({ ok: false, error: 'Server is not configured' }, 500);
  const admin = createClient(supabaseUrl, serviceRoleKey);
  await expireStaleTrials(admin);
  if (!(await hostPlanIsActive(admin, hostId))) {
    return json({ ok: false, error: 'Reactivate Pro to send messages.' }, 403);
  }

  let payload: { bookingId?: string; etaMinutes?: number; channel?: string };
  try {
    payload = await req.json();
  } catch {
    return json({ ok: false, error: 'Invalid JSON' }, 400);
  }

  const bookingId = payload.bookingId?.trim();
  const eta = clampOnMyWayEta(Number(payload.etaMinutes));
  const channel = payload.channel === 'email' ? 'email' : 'sms';
  if (!bookingId || eta == null) {
    return json({ ok: false, error: 'bookingId and a valid etaMinutes are required' }, 400);
  }

  const { data: booking, error: bErr } = await admin
    .from('bookings')
    .select('id, host_id, guest_name, guest_email, guest_phone, notify_via, status, sent_on_my_way_at, start_time')
    .eq('id', bookingId)
    .eq('host_id', hostId)
    .maybeSingle();

  if (bErr || !booking) return json({ ok: false, error: 'Booking not found' }, 404);
  if (booking.status === 'canceled' || booking.status === 'no_show') {
    return json({ ok: false, error: 'This booking is not active.' }, 400);
  }
  if (booking.sent_on_my_way_at) {
    return json({ ok: false, error: 'Already notified.', already: true, code: 'already_sent' }, 409);
  }

  const { data: profile } = await admin
    .from('profiles')
    .select('full_name, business_name, paid_booking_settings, on_my_way_template, on_my_way_default_eta_minutes, on_my_way_eta_usage')
    .eq('id', hostId)
    .maybeSingle();

  const settings = (profile?.paid_booking_settings ?? {}) as Record<string, unknown>;
  const businessName =
    (typeof profile?.business_name === 'string' && profile.business_name.trim())
    || (typeof settings.display_name === 'string' && settings.display_name.trim())
    || (typeof profile?.full_name === 'string' && profile.full_name.trim())
    || 'PinOnIt';
  const first = hostFirstName(profile?.full_name);
  const body = renderOnMyWayMessage({
    template: profile?.on_my_way_template,
    businessName,
    hostFirstName: first,
    eta,
  });

  if (channel === 'sms') {
    if (!ON_MY_WAY_SMS_ENABLED) {
      return json({
        ok: false,
        error: 'On-my-way texts are off until our SMS campaign includes them.',
        code: 'a2p_pending',
      }, 403);
    }
    if (!bookingAllowsGuestSms({ guest_phone: booking.guest_phone, notify_via: booking.notify_via })) {
      return json({
        ok: false,
        error: 'This guest did not consent to SMS.',
        code: 'no_sms_consent',
      }, 403);
    }
    const sms = await sendTwilioSmsGuarded(admin, booking.guest_phone, body);
    if (!sms.ok) {
      if (sms.skipped === 'opted_out') {
        return json({ ok: false, error: 'Recipient opted out of SMS (STOP).', code: 'opted_out' }, 403);
      }
      return json({ ok: false, error: sms.error || 'SMS could not be sent' });
    }
    await logHostSmsUsage(admin, {
      hostId,
      bookingId: booking.id,
      recipient: String(booking.guest_phone),
      subject: 'On my way',
      body,
      status: 'sent',
    });
  } else {
    const to = (booking.guest_email || '').trim();
    if (!to) return json({ ok: false, error: 'No email on this booking.', code: 'no_email' }, 400);
    const sent = await sendResendEmail(to, `${businessName} is on the way`, body);
    if (!sent) return json({ ok: false, error: 'Email could not be sent' });
  }

  const sentAt = new Date().toISOString();
  const usage = bumpOnMyWayEtaUsage(
    (profile?.on_my_way_eta_usage ?? {}) as Record<string, number>,
    eta,
  );
  const defaultEta = pickDefaultOnMyWayEta(usage, eta);

  await Promise.all([
    admin.from('bookings').update({
      sent_on_my_way_at: sentAt,
      on_my_way_eta_minutes: eta,
    }).eq('id', booking.id).eq('host_id', hostId),
    admin.from('profiles').update({
      on_my_way_default_eta_minutes: defaultEta,
      on_my_way_eta_usage: usage,
    }).eq('id', hostId),
  ]);

  return json({
    ok: true,
    channel,
    sent_on_my_way_at: sentAt,
    on_my_way_eta_minutes: eta,
  });
});
