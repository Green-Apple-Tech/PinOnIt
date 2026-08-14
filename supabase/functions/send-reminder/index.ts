import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { appendSmsOptOut } from '../_shared/sms-opt-out.ts';
import { NOREPLY_FROM, SUPPORT_EMAIL } from '../_shared/contact-email.ts';
import { bookingAllowsGuestSms, bookingAllowsGuestWhatsapp } from '../_shared/sms-compliance.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface TemplateData {
  guest_name: string;
  host_name: string;
  service_name: string;
  date: string;
  time: string;
  timezone: string;
  duration: string;
  booking_link: string;
  cancel_link: string;
  confirm_link: string;
}

function fillTemplate(template: string, data: TemplateData): string {
  return template
    .replace(/\{\{guest_name\}\}/g, data.guest_name)
    .replace(/\{\{host_name\}\}/g, data.host_name)
    .replace(/\{\{service_name\}\}/g, data.service_name)
    .replace(/\{\{date\}\}/g, data.date)
    .replace(/\{\{time\}\}/g, data.time)
    .replace(/\{\{timezone\}\}/g, data.timezone)
    .replace(/\{\{duration\}\}/g, data.duration)
    .replace(/\{\{booking_link\}\}/g, data.booking_link)
    .replace(/\{\{cancel_link\}\}/g, data.cancel_link)
    .replace(/\{\{confirm_link\}\}/g, data.confirm_link);
}

const TRANSLATION_SYSTEM_PROMPT = `You are a professional translator for appointment scheduling messages. Preserve all formatting, URLs, and template placeholders exactly as they are (e.g. {{guest_name}}, {{cancel_link}}). Only return the translated text, nothing else.`;

async function translateText(text: string, targetLang: string, sourceLang: string): Promise<string> {
  if (targetLang === sourceLang) return text;

  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!anthropicKey) return text;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 1024,
        system: [
          {
            type: 'text',
            text: TRANSLATION_SYSTEM_PROMPT,
            cache_control: { type: 'ephemeral' },
          },
        ],
        messages: [
          {
            role: 'user',
            content: `Translate the following text from ${sourceLang} to ${targetLang}:\n\n${text}`,
          },
        ],
      }),
    });

    const data = await response.json();
    const block = data.content?.[0];
    return (block?.type === 'text' ? block.text.trim() : null) ?? text;
  } catch {
    return text;
  }
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Human-readable lead time from template offset (minutes before event). */
function formatTimeUntil(offsetMinutes: number): string {
  const abs = Math.abs(offsetMinutes);
  if (abs === 0) return 'a moment';
  if (abs < 60) return `${abs} minute${abs === 1 ? '' : 's'}`;
  const hours = Math.round(abs / 60);
  if (hours < 48) return `${hours} hour${hours === 1 ? '' : 's'}`;
  const days = Math.round(abs / 1440);
  return `${days} day${days === 1 ? '' : 's'}`;
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

function buildCustomVoiceTwiml(message: string): string {
  const safe = escapeXml(message);
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">${safe}</Say>
</Response>`;
}

async function sendTwilioVoice(to: string, twiml: string): Promise<{ ok: boolean; error?: string }> {
  const twilioSid = Deno.env.get('TWILIO_ACCOUNT_SID');
  const twilioToken = Deno.env.get('TWILIO_AUTH_TOKEN');
  const twilioFrom = Deno.env.get('TWILIO_PHONE_NUMBER');

  if (!twilioSid || !twilioToken || !twilioFrom) {
    console.warn('Twilio credentials not configured — skipping voice call');
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
    if (!res.ok) {
      const err = await res.text();
      console.error('Twilio voice error:', err);
      return { ok: false, error: err };
    }
    return { ok: true };
  } catch (e) {
    console.error('Twilio voice call error:', e);
    return { ok: false, error: String(e) };
  }
}

async function sendTwilioSms(to: string, body: string): Promise<{ ok: boolean; error?: string }> {
  const twilioSid = Deno.env.get('TWILIO_ACCOUNT_SID');
  const twilioToken = Deno.env.get('TWILIO_AUTH_TOKEN');
  const messagingServiceSid = Deno.env.get('TWILIO_MESSAGING_SERVICE_SID');

  if (!twilioSid || !twilioToken || !messagingServiceSid) {
    console.warn('Twilio credentials not configured — skipping SMS send');
    return { ok: false, error: 'Twilio credentials not configured' };
  }

  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + btoa(`${twilioSid}:${twilioToken}`),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ MessagingServiceSid: messagingServiceSid, To: to, Body: appendSmsOptOut(body) }),
      }
    );
    if (!res.ok) {
      const err = await res.text();
      console.error('Twilio error:', err);
      return { ok: false, error: err };
    }
    return { ok: true };
  } catch (e) {
    console.error('Twilio send error:', e);
    return { ok: false, error: String(e) };
  }
}

async function sendTwilioWhatsapp(to: string, body: string): Promise<{ ok: boolean; error?: string }> {
  const twilioSid = Deno.env.get('TWILIO_ACCOUNT_SID');
  const twilioToken = Deno.env.get('TWILIO_AUTH_TOKEN');
  const whatsappFrom = Deno.env.get('TWILIO_WHATSAPP_NUMBER');

  if (!twilioSid || !twilioToken || !whatsappFrom) {
    console.warn('Twilio WhatsApp credentials not configured — skipping WhatsApp send');
    return { ok: false, error: 'Twilio WhatsApp credentials not configured' };
  }

  const waFrom = whatsappFrom.startsWith('whatsapp:') ? whatsappFrom : `whatsapp:${whatsappFrom}`;
  const waTo = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;

  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + btoa(`${twilioSid}:${twilioToken}`),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ From: waFrom, To: waTo, Body: appendSmsOptOut(body) }),
      }
    );
    if (!res.ok) {
      const err = await res.text();
      console.error('Twilio WhatsApp error:', err);
      return { ok: false, error: err };
    }
    return { ok: true };
  } catch (e) {
    console.error('Twilio WhatsApp send error:', e);
    return { ok: false, error: String(e) };
  }
}

function jsonResponse(body: object, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function hostEmailRecipients(hostProfile: Record<string, unknown>): string[] {
  const hostEmail = (hostProfile?.email as string | null | undefined)?.trim();
  const notificationEmail = (hostProfile?.notification_email as string | null | undefined)?.trim();
  const recipients: string[] = [];
  if (hostEmail) recipients.push(hostEmail);
  if (notificationEmail && notificationEmail !== hostEmail) recipients.push(notificationEmail);
  return recipients;
}

async function sendResendEmail(
  to: string[],
  subject: string,
  msgBody: string,
  resendKey: string,
): Promise<boolean> {
  const fromEmail = Deno.env.get('RESEND_FROM_EMAIL') ?? NOREPLY_FROM;
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
        reply_to: SUPPORT_EMAIL,
        to,
        subject,
        text: msgBody,
        html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#020617;color:#e2e8f0;border-radius:8px;">${
          msgBody.split('\n').map((line: string) => `<p style="margin:0 0 12px">${line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;')}</p>`).join('')
        }</div>`,
      }),
    });
    if (!res.ok) {
      console.error('Resend error:', await res.text());
      return false;
    }
    return true;
  } catch (e) {
    console.error('Resend send error:', e);
    return false;
  }
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

    const body = await req.json();

    // ── Recurring cancellation notice ─────────────────────────────────────
    if (body.notify_cancellation && body.booking_id && body.message) {
      const { data: booking } = await supabase
        .from('bookings')
        .select('guest_email, guest_name')
        .eq('id', body.booking_id)
        .maybeSingle();
      if (!booking?.guest_email) {
        return jsonResponse({ error: 'Booking or guest email not found' }, 404);
      }
      const resendKey = Deno.env.get('RESEND_API_KEY');
      if (resendKey) {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: NOREPLY_FROM,
            reply_to: SUPPORT_EMAIL,
            to: [booking.guest_email],
            subject: 'Your recurring booking has been cancelled',
            text: body.message as string,
          }),
        });
      }
      return jsonResponse({ success: true });
    }

    // ── Test SMS mode ────────────────────────────────────────────────────────
    if (body.test_sms) {
      const { to, guest_name, host_name, duration, date, time, meeting_link } = body;
      if (!to) return jsonResponse({ error: 'Missing to phone number' }, 400);

      const twilioSid = Deno.env.get('TWILIO_ACCOUNT_SID');
      if (!twilioSid) {
        return jsonResponse({ error: 'Twilio credentials are not configured on this account.' }, 503);
      }

      const msg = [
        `Hi ${guest_name ?? 'Guest'}, reminder: you have a ${duration ?? '30'} min meeting with ${host_name ?? 'your host'} on ${date ?? 'your scheduled date'} at ${time ?? 'your scheduled time'}.`,
        meeting_link ? `Join: ${meeting_link}` : '',
        '— PinOnIt',
      ].filter(Boolean).join(' ');

      const result = await sendTwilioSms(to, msg);
      if (!result.ok) return jsonResponse({ error: result.error }, 502);
      return jsonResponse({ success: true, to });
    }

    // ── Extra event reminders (click-to-remind overrides) ────────────────────
    if (body.dispatch_event_overrides) {
      const now = Date.now();
      const windowMs = 15 * 60 * 1000;
      const { data: overrides } = await supabase
        .from('event_reminder_overrides')
        .select('id, channel, offset_minutes, message, booking_id, calendar_event_id, host_id')
        .is('sent_at', null)
        .limit(250);

      let sent = 0;
      for (const ov of overrides ?? []) {
        const offsetMs = (ov.offset_minutes ?? -60) * 60 * 1000;
        let startIso: string | null = null;
        let title = 'Meeting';
        let guestName = '';
        let guestEmail: string | null = null;
        let guestPhone: string | null = null;
        let notifyVia: unknown = null;
        let hostEmail: string | null = null;
        let hostPhone: string | null = null;
        let hostWhatsapp: string | null = null;
        let hostName = 'PinOnIt';
        let meetLink: string | null = null;

        if (ov.booking_id) {
          const { data: booking } = await supabase
            .from('bookings')
            .select('guest_name, guest_email, guest_phone, notify_via, start_time, status, meet_link, services(name), profiles(full_name, email, notification_email, phone, whatsapp_number)')
            .eq('id', ov.booking_id)
            .maybeSingle();
          if (!booking || booking.status === 'canceled' || booking.status === 'completed') continue;
          startIso = booking.start_time;
          const svc = booking.services as { name?: string } | null;
          title = svc?.name ?? 'Appointment';
          guestName = booking.guest_name ?? '';
          guestEmail = booking.guest_email;
          guestPhone = booking.guest_phone ?? null;
          notifyVia = booking.notify_via;
          meetLink = booking.meet_link ?? null;
          const hp = booking.profiles as Record<string, unknown> | null;
          hostName = (hp?.full_name as string) || hostName;
          hostEmail = ((hp?.notification_email as string) || (hp?.email as string) || null);
          hostPhone = (hp?.phone as string) || null;
          hostWhatsapp = (hp?.whatsapp_number as string) || hostPhone;
        } else if (ov.calendar_event_id) {
          const { data: ev } = await supabase
            .from('calendar_events')
            .select('title, start_at, host_id')
            .eq('id', ov.calendar_event_id)
            .maybeSingle();
          if (!ev) continue;
          startIso = ev.start_at;
          title = ev.title || 'Calendar event';
          const { data: hp } = await supabase
            .from('profiles')
            .select('full_name, email, notification_email, phone, whatsapp_number')
            .eq('id', ov.host_id)
            .maybeSingle();
          hostName = hp?.full_name || hostName;
          hostEmail = hp?.notification_email || hp?.email || null;
          hostPhone = hp?.phone || null;
          hostWhatsapp = hp?.whatsapp_number || hostPhone;
          guestName = hostName;
        }

        if (!startIso) continue;
        const fireAt = new Date(startIso).getTime() + offsetMs;
        if (fireAt > now || now - fireAt > windowMs) continue;

        const when = new Date(startIso);
        const dateStr = when.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
        const timeStr = when.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
        const msg = (ov.message as string)?.trim() ||
          `Reminder: ${title}${guestName ? ` with ${guestName}` : ''} on ${dateStr} at ${timeStr}.`;
        const withLink = meetLink ? `${msg}\nJoin: ${meetLink}` : msg;

        if (ov.channel === 'email') {
          const resendKey = Deno.env.get('RESEND_API_KEY');
          const to = guestEmail || hostEmail;
          if (resendKey && to) {
            await sendResendEmail([to], `Reminder: ${title}`, withLink, resendKey);
            sent++;
          }
        } else if (ov.channel === 'sms') {
          const to = bookingAllowsGuestSms({ guest_phone: guestPhone, notify_via: notifyVia })
            ? guestPhone
            : hostPhone;
          if (to) {
            const result = await sendTwilioSms(to, withLink);
            if (result.ok) sent++;
          }
        } else if (ov.channel === 'whatsapp') {
          const to = bookingAllowsGuestWhatsapp({ guest_phone: guestPhone, notify_via: notifyVia })
            ? guestPhone
            : hostWhatsapp;
          if (to) {
            const result = await sendTwilioWhatsapp(to, withLink);
            if (result.ok) sent++;
          }
        }

        await supabase
          .from('event_reminder_overrides')
          .update({ sent_at: new Date().toISOString() })
          .eq('id', ov.id);
      }

      return jsonResponse({ success: true, sent });
    }

    // ── Normal reminder mode ─────────────────────────────────────────────────
    const { booking_id, template_id, channel } = body;
    if (!booking_id || !template_id) {
      return jsonResponse({ error: 'Missing booking_id or template_id' }, 400);
    }

    const { data: booking } = await supabase
      .from('bookings')
      .select('*, services(name, duration_minutes), profiles(full_name, slug, timezone, email, notification_email)')
      .eq('id', booking_id)
      .maybeSingle();

    if (!booking) {
      return jsonResponse({ error: 'Booking not found' }, 404);
    }

    const { data: template } = await supabase
      .from('message_templates')
      .select('*')
      .eq('id', template_id)
      .maybeSingle();

    if (!template) {
      return jsonResponse({ error: 'Template not found' }, 404);
    }

    const hostProfile = booking.profiles as Record<string, unknown>;
    const service = booking.services as Record<string, unknown>;
    const baseUrl = Deno.env.get('SUPABASE_URL')!.replace('/v1', '').replace('supabase.co', 'pinonit.app');

    const templateData: TemplateData = {
      guest_name: booking.guest_name,
      host_name: (hostProfile?.full_name as string) ?? 'Your host',
      service_name: (service?.name as string) ?? 'Appointment',
      date: new Date(booking.start_time).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }),
      time: new Date(booking.start_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
      timezone: booking.guest_timezone ?? (hostProfile?.timezone as string) ?? 'UTC',
      duration: `${service?.duration_minutes ?? 30} min`,
      booking_link: `${baseUrl}/${hostProfile?.slug ?? ''}`,
      cancel_link: `${baseUrl}/booking/${booking.id}/cancel/${booking.action_token}`,
      confirm_link: `${baseUrl}/booking/${booking.id}/confirm/${booking.action_token}`,
    };

    let subject = template.subject ? fillTemplate(template.subject, templateData) : null;
    let msgBody = fillTemplate(template.body, templateData);

    // AI translation if enabled
    let sentLanguage = template.language;
    if (template.auto_translate && booking.guest_timezone) {
      const tzLangMap: Record<string, string> = {
        'America/New_York': 'en', 'America/Chicago': 'en', 'America/Denver': 'en',
        'America/Los_Angeles': 'en', 'America/Toronto': 'en', 'America/Vancouver': 'en',
        'Europe/London': 'en', 'Europe/Paris': 'fr', 'Europe/Berlin': 'de',
        'Europe/Amsterdam': 'nl', 'Asia/Tokyo': 'ja', 'Asia/Shanghai': 'zh',
        'Asia/Kolkata': 'hi', 'Australia/Sydney': 'en',
      };
      const targetLang = tzLangMap[booking.guest_timezone] ?? 'en';

      if (targetLang !== template.language) {
        if (subject) subject = await translateText(subject, targetLang, template.language);
        msgBody = await translateText(msgBody, targetLang, template.language);
        sentLanguage = targetLang;
      }
    }

    const sendChannel = channel ?? (template.channel === 'both' ? 'email' : template.channel);

    let deliveryStatus = 'sent';

    // ── Email via Resend ─────────────────────────────────────────────────────
    const resendKey = Deno.env.get('RESEND_API_KEY');
    if (sendChannel === 'email' && resendKey) {
      if (booking.guest_email) {
        const ok = await sendResendEmail(
          [booking.guest_email],
          subject ?? 'Your appointment reminder',
          msgBody,
          resendKey,
        );
        if (!ok) deliveryStatus = 'failed';
      } else {
        deliveryStatus = 'failed';
      }

      // Host copies for booking confirmations and reminders
      if (template.type === 'confirmation' || template.type === 'reminder') {
        const recipients = hostEmailRecipients(hostProfile);
        if (recipients.length > 0) {
          const hostSubject = template.type === 'confirmation'
            ? `New booking: ${templateData.service_name} with ${templateData.guest_name}`
            : `Upcoming: ${templateData.service_name} with ${templateData.guest_name} — ${templateData.date} at ${templateData.time}`;
          const hostBody = template.type === 'confirmation'
            ? [
                'You have a new booking.',
                '',
                `Guest: ${templateData.guest_name}`,
                `Service: ${templateData.service_name}`,
                `When: ${templateData.date} at ${templateData.time} (${templateData.timezone})`,
                `Duration: ${templateData.duration}`,
              ].join('\n')
            : [
                `Reminder: ${templateData.guest_name} has ${templateData.service_name} scheduled.`,
                '',
                `When: ${templateData.date} at ${templateData.time} (${templateData.timezone})`,
                `Duration: ${templateData.duration}`,
              ].join('\n');

          for (const recipient of recipients) {
            await sendResendEmail([recipient], hostSubject, hostBody, resendKey);
          }
        }
      }
    }

    // ── SMS via Twilio ───────────────────────────────────────────────────────
    if (sendChannel === 'sms') {
      if (!bookingAllowsGuestSms(booking)) {
        console.warn('Guest has not opted in to SMS or has no phone, booking:', booking_id);
        deliveryStatus = 'failed';
      } else {
        const guestPhone = booking.guest_phone!;
        const smsBody = [
          `Hi ${templateData.guest_name}, reminder: you have a ${templateData.duration} meeting with ${templateData.host_name} on ${templateData.date} at ${templateData.time}.`,
          booking.meeting_link ? `Join: ${booking.meeting_link}` : '',
          '— PinOnIt',
        ].filter(Boolean).join(' ');

        const result = await sendTwilioSms(guestPhone, smsBody);
        if (!result.ok) {
          console.warn('SMS delivery failed:', result.error);
          deliveryStatus = 'failed';
        }
      }
    }

    // ── WhatsApp via Twilio ──────────────────────────────────────────────────
    if (sendChannel === 'whatsapp') {
      if (!bookingAllowsGuestWhatsapp(booking)) {
        console.warn('Guest has not opted in to WhatsApp or has no phone, booking:', booking_id);
        deliveryStatus = 'failed';
      } else {
        const guestPhone = booking.guest_phone!;
        const waBody = msgBody || [
          `Hi ${templateData.guest_name}, reminder: you have a ${templateData.duration} meeting with ${templateData.host_name} on ${templateData.date} at ${templateData.time}.`,
          booking.meeting_link ? `Join: ${booking.meeting_link}` : '',
          '— PinOnIt',
        ].filter(Boolean).join(' ');

        const result = await sendTwilioWhatsapp(guestPhone, waBody);
        if (!result.ok) {
          console.warn('WhatsApp delivery failed:', result.error);
          deliveryStatus = 'failed';
        }
      }
    }

    // ── Voice call via Twilio ────────────────────────────────────────────────
    if (sendChannel === 'voice') {
      const guestPhone = booking.guest_phone;
      if (guestPhone) {
        const hostVoiceTemplate = (hostProfile?.voice_message_template as string | null) ?? null;
        const offsetMinutes = Math.abs((template.timing_offset_minutes as number) ?? 0);
        const timeUntil = formatTimeUntil(offsetMinutes);

        const twiml = hostVoiceTemplate
          ? buildCustomVoiceTwiml(
              hostVoiceTemplate
                .replace(/\{\{host_name\}\}/g, templateData.host_name)
                .replace(/\{\{service_name\}\}/g, templateData.service_name)
                .replace(/\{\{date\}\}/g, templateData.date)
                .replace(/\{\{time\}\}/g, templateData.time)
                .replace(/\{\{guest_name\}\}/g, templateData.guest_name),
            )
          : buildPinOnItVoiceTwiml(timeUntil);

        const result = await sendTwilioVoice(guestPhone, twiml);
        if (!result.ok) {
          console.warn('Voice call delivery failed:', result.error);
          deliveryStatus = 'failed';
        }
      } else {
        console.warn('No guest phone number for voice reminder, booking:', booking_id);
        deliveryStatus = 'failed';
      }
    }

    // ── Log the message ──────────────────────────────────────────────────────
    const { data: logEntry } = await supabase
      .from('message_log')
      .insert({
        booking_id: booking.id,
        host_id: booking.host_id,
        template_id: template.id,
        channel: sendChannel,
        status: deliveryStatus,
        recipient: sendChannel === 'sms' || sendChannel === 'whatsapp' || sendChannel === 'voice'
          ? (booking.guest_phone ?? booking.guest_email)
          : booking.guest_email,
        subject,
        body: msgBody,
        language: sentLanguage,
        sent_at: new Date().toISOString(),
      })
      .select()
      .maybeSingle();

    return jsonResponse({
      success: true,
      log_id: logEntry?.id,
      channel: sendChannel,
      language: sentLanguage,
      translated: sentLanguage !== template.language,
      delivered: deliveryStatus === 'sent',
    });
  } catch (err) {
    return jsonResponse({ error: (err as Error).message }, 500);
  }
});
