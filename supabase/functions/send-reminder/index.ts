import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

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

async function sendTwilioVoice(to: string, message: string): Promise<{ ok: boolean; error?: string }> {
  const twilioSid = Deno.env.get('TWILIO_ACCOUNT_SID');
  const twilioToken = Deno.env.get('TWILIO_AUTH_TOKEN');
  const twilioFrom = Deno.env.get('TWILIO_PHONE_NUMBER');

  if (!twilioSid || !twilioToken || !twilioFrom) {
    console.warn('Twilio credentials not configured — skipping voice call');
    return { ok: false, error: 'Twilio credentials not configured' };
  }

  // Twilio TwiML to speak the message
  const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="alice">${message}</Say><Pause length="1"/><Say voice="alice">${message}</Say></Response>`;
  const twimlUrl = `https://twimlets.com/echo?Twiml=${encodeURIComponent(twiml)}`;

  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Calls.json`,
      {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + btoa(`${twilioSid}:${twilioToken}`),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ From: twilioFrom, To: to, Url: twimlUrl }),
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
        body: new URLSearchParams({ MessagingServiceSid: messagingServiceSid, To: to, Body: body }),
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
        body: new URLSearchParams({ From: waFrom, To: waTo, Body: body }),
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
            from: 'PinOnIt <noreply@pinonit.com>',
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

    // ── Normal reminder mode ─────────────────────────────────────────────────
    const { booking_id, template_id, channel } = body;
    if (!booking_id || !template_id) {
      return jsonResponse({ error: 'Missing booking_id or template_id' }, 400);
    }

    const { data: booking } = await supabase
      .from('bookings')
      .select('*, services(name, duration_minutes), profiles(full_name, slug, timezone)')
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
      try {
        const fromEmail = Deno.env.get('RESEND_FROM_EMAIL') ?? 'Pin on It <noreply@pinonit.app>';
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: fromEmail,
            to: [booking.guest_email],
            subject: subject ?? 'Your appointment reminder',
            text: msgBody,
            html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#020617;color:#e2e8f0;border-radius:8px;">${
              msgBody.split('\n').map((line: string) => `<p style="margin:0 0 12px">${line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;')}</p>`).join('')
            }</div>`,
          }),
        });
        if (!res.ok) {
          const err = await res.text();
          console.error('Resend error:', err);
          deliveryStatus = 'failed';
        }
      } catch (e) {
        console.error('Resend send error:', e);
        deliveryStatus = 'failed';
      }
    }

    // ── SMS via Twilio ───────────────────────────────────────────────────────
    if (sendChannel === 'sms') {
      const guestPhone = booking.guest_phone;
      if (guestPhone) {
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
      } else {
        console.warn('No guest phone number for SMS reminder, booking:', booking_id);
        deliveryStatus = 'failed';
      }
    }

    // ── WhatsApp via Twilio ──────────────────────────────────────────────────
    if (sendChannel === 'whatsapp') {
      const guestPhone = booking.guest_phone;
      if (guestPhone) {
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
      } else {
        console.warn('No guest phone number for WhatsApp reminder, booking:', booking_id);
        deliveryStatus = 'failed';
      }
    }

    // ── Voice call via Twilio ────────────────────────────────────────────────
    if (sendChannel === 'voice') {
      const guestPhone = booking.guest_phone;
      if (guestPhone) {
        // Use custom voice template from host profile if set, otherwise default script
        const hostVoiceTemplate = (hostProfile?.voice_message_template as string | null) ?? null;
        const voiceMsg = hostVoiceTemplate
          ? hostVoiceTemplate
              .replace(/\{\{host_name\}\}/g, templateData.host_name)
              .replace(/\{\{service_name\}\}/g, templateData.service_name)
              .replace(/\{\{date\}\}/g, templateData.date)
              .replace(/\{\{time\}\}/g, templateData.time)
          : `Hi, this is a reminder from ${templateData.host_name} that you have a ${templateData.service_name} scheduled for ${templateData.date} at ${templateData.time}. We look forward to speaking with you.`;

        const result = await sendTwilioVoice(guestPhone, voiceMsg);
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
