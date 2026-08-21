import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { appendSmsOptOut } from '../_shared/sms-opt-out.ts';
import { NOREPLY_FROM, SUPPORT_EMAIL } from '../_shared/contact-email.ts';
import { bookingAllowsGuestSms, bookingAllowsGuestWhatsapp, hostAllowsSms, hostAllowsWhatsapp } from '../_shared/sms-compliance.ts';
import { isServiceRoleRequest, jsonAuthError } from '../_shared/callerAuth.ts';
import { isValidSlackWebhookUrl, notifySlackWebhook } from '../_shared/slack-webhook.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey, X-Cron-Secret',
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
  reschedule_link: string;
}

const APP_PUBLIC_URL = (Deno.env.get('APP_URL') || 'https://pinonit.com').replace(/\/$/, '');

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
    .replace(/\{\{confirm_link\}\}/g, data.confirm_link)
    .replace(/\{\{reschedule_link\}\}/g, data.reschedule_link);
}

function withChangeThisLink(body: string, link: string): string {
  if (!link) return body;
  if (body.includes(link) || /need to change this/i.test(body)) return body;
  return `${body.trim()}\nNeed to change this? ${link}`;
}

async function ensureRescheduleLink(
  supabase: { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown }> },
  bookingId: string,
): Promise<string> {
  try {
    const { data } = await supabase.rpc('ensure_reschedule_token', { p_booking_id: bookingId });
    const token = typeof data === 'string' ? data : '';
    return token ? `${APP_PUBLIC_URL}/r/${token}` : '';
  } catch {
    return '';
  }
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

type WhatsAppVars = {
  guest_name?: string;
  host_name?: string;
  service_name?: string;
  date?: string;
  time?: string;
  duration?: string;
};

const WHATSAPP_TEMPLATE_MISSING =
  'WhatsApp is not configured for first-contact messages. In Twilio, create a Utility Content template with variables {{1}} guest name, {{2}} host name, {{3}} date, {{4}} time, submit it for WhatsApp approval, then set the TWILIO_WHATSAPP_CONTENT_SID secret (starts with HX). Freeform WhatsApp only works if the recipient messaged your business number in the last 24 hours (error 63016).';

function whatsappFromNumber(): string | null {
  const raw = (Deno.env.get('TWILIO_WHATSAPP_NUMBER') || Deno.env.get('TWILIO_WHATSAPP_FROM') || '').trim();
  if (!raw) return null;
  return raw.startsWith('whatsapp:') ? raw : `whatsapp:${raw}`;
}

function whatsappContentSid(): string | null {
  const sid = (Deno.env.get('TWILIO_WHATSAPP_CONTENT_SID') || '').trim();
  return sid || null;
}

function buildWhatsappContentVariables(vars: WhatsAppVars): string {
  return JSON.stringify({
    '1': vars.guest_name || 'Guest',
    '2': vars.host_name || 'your host',
    '3': vars.date || 'your scheduled date',
    '4': vars.time || 'your scheduled time',
  });
}

function whatsappVarsFromBooking(
  booking: Record<string, unknown>,
  hostProfile: Record<string, unknown> | null,
): WhatsAppVars {
  const service = booking.services as Record<string, unknown> | null;
  const start = booking.start_time ? new Date(String(booking.start_time)) : null;
  const startOk = start !== null && !Number.isNaN(start.getTime());
  return {
    guest_name: (booking.guest_name as string) || 'Guest',
    host_name: (hostProfile?.full_name as string) || 'your host',
    service_name: (service?.name as string) || 'meeting',
    date: startOk
      ? start.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
      : 'your scheduled date',
    time: startOk
      ? start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
      : 'your scheduled time',
    duration: `${service?.duration_minutes ?? 30} min`,
  };
}

function humanizeTwilioWhatsappError(raw: string, errorCode?: number | null): string {
  let code = errorCode ?? null;
  let message = raw;
  try {
    const parsed = JSON.parse(raw) as {
      code?: number;
      message?: string;
      error_code?: number;
      error_message?: string;
    };
    code = code ?? parsed.code ?? parsed.error_code ?? null;
    message = parsed.message || parsed.error_message || raw;
  } catch {
    /* not JSON */
  }
  if (code === 63016 || /63016/.test(raw) || /outside the allowed window/i.test(raw)) {
    return 'WhatsApp did not deliver (error 63016): outside the 24-hour window. Approve a Utility template in Twilio and set TWILIO_WHATSAPP_CONTENT_SID, or have the recipient message your WhatsApp business number first, then retry within 24 hours.';
  }
  if (code === 63007) {
    return 'WhatsApp sender is not a WhatsApp-enabled Twilio number (error 63007). Set TWILIO_WHATSAPP_NUMBER to your WhatsApp sender.';
  }
  if (typeof code === 'number') return `WhatsApp send failed (error ${code}): ${message}`;
  return message || 'WhatsApp send failed.';
}

async function waitForTwilioMessageOutcome(
  twilioSid: string,
  twilioToken: string,
  messageSid: string,
  timeoutMs = 5000,
): Promise<{ status: string; error_code: number | null; error_message: string | null }> {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages/${messageSid}.json`;
  const auth = 'Basic ' + btoa(`${twilioSid}:${twilioToken}`);
  const started = Date.now();
  let last = { status: 'queued', error_code: null as number | null, error_message: null as string | null };
  while (Date.now() - started < timeoutMs) {
    const res = await fetch(url, { headers: { Authorization: auth } });
    if (res.ok) {
      const data = await res.json() as {
        status?: string;
        error_code?: number | null;
        error_message?: string | null;
      };
      last = {
        status: data.status ?? last.status,
        error_code: data.error_code ?? null,
        error_message: data.error_message ?? null,
      };
      if (['delivered', 'sent', 'read', 'failed', 'undelivered', 'canceled'].includes(last.status)) {
        return last;
      }
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  return last;
}

async function sendTwilioWhatsapp(
  to: string,
  vars: WhatsAppVars,
  options?: { waitForStatus?: boolean },
): Promise<{ ok: boolean; error?: string; sid?: string }> {
  const twilioSid = Deno.env.get('TWILIO_ACCOUNT_SID');
  const twilioToken = Deno.env.get('TWILIO_AUTH_TOKEN');
  const waFrom = whatsappFromNumber();
  const contentSid = whatsappContentSid();

  if (!twilioSid || !twilioToken || !waFrom) {
    console.warn('Twilio WhatsApp sender not configured — skipping WhatsApp send');
    return {
      ok: false,
      error: 'Twilio WhatsApp sender is not configured. Set TWILIO_WHATSAPP_NUMBER to your WhatsApp-enabled Twilio number.',
    };
  }
  if (!contentSid) {
    console.warn('TWILIO_WHATSAPP_CONTENT_SID missing — refusing freeform WhatsApp send');
    return { ok: false, error: WHATSAPP_TEMPLATE_MISSING };
  }

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
        body: new URLSearchParams({
          From: waFrom,
          To: waTo,
          ContentSid: contentSid,
          ContentVariables: buildWhatsappContentVariables(vars),
        }),
      }
    );
    const raw = await res.text();
    let parsed: {
      sid?: string;
      status?: string;
      error_code?: number;
      error_message?: string;
      message?: string;
      code?: number;
    } = {};
    try {
      parsed = JSON.parse(raw);
    } catch {
      /* ignore */
    }

    if (!res.ok) {
      const err = humanizeTwilioWhatsappError(raw, parsed.code ?? parsed.error_code);
      console.error('Twilio WhatsApp error:', err);
      return { ok: false, error: err, sid: parsed.sid };
    }

    const sid = parsed.sid;
    if (options?.waitForStatus && sid) {
      const outcome = await waitForTwilioMessageOutcome(twilioSid, twilioToken, sid);
      if (outcome.status === 'failed' || outcome.status === 'undelivered') {
        return {
          ok: false,
          error: humanizeTwilioWhatsappError(outcome.error_message || raw, outcome.error_code),
          sid,
        };
      }
    }

    return { ok: true, sid };
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

const GUEST_REMINDER_TIME_OFFSETS: Record<string, number> = {
  '15min': -15,
  '30min': -30,
  '1hour': -60,
  '2hour': -120,
  '6hour': -360,
  '24hour': -1440,
};

type SupabaseClient = ReturnType<typeof createClient>;

async function insertMessageLog(
  supabase: SupabaseClient,
  row: {
    booking_id?: string | null;
    host_id: string;
    template_id?: string | null;
    channel: string;
    status: string;
    recipient: string;
    subject?: string | null;
    body: string;
  },
): Promise<void> {
  const { error } = await supabase.from('message_log').insert({
    booking_id: row.booking_id ?? null,
    host_id: row.host_id,
    template_id: row.template_id ?? null,
    channel: row.channel,
    status: row.status,
    recipient: row.recipient,
    subject: row.subject ?? null,
    body: row.body,
    language: 'en',
    sent_at: new Date().toISOString(),
  });
  if (error) console.error('message_log insert failed:', error.message);
}

async function alreadyLogged(
  supabase: SupabaseClient,
  bookingId: string,
  channel: string,
  subject: string,
): Promise<boolean> {
  const { data } = await supabase
    .from('message_log')
    .select('id')
    .eq('booking_id', bookingId)
    .eq('channel', channel)
    .eq('subject', subject)
    .limit(1)
    .maybeSingle();
  return Boolean(data);
}

async function dispatchPersonalReminders(supabase: SupabaseClient): Promise<number> {
  const now = Date.now();
  const fromIso = new Date(now - 25 * 60 * 1000).toISOString();
  const toIso = new Date(now + 2 * 60 * 1000).toISOString();
  const { data: jobs, error } = await supabase
    .from('personal_reminder_jobs')
    .select('id, host_id, fire_at, channel, reminder_id, personal_reminders(title, due_at, status)')
    .is('sent_at', null)
    .gte('fire_at', fromIso)
    .lte('fire_at', toIso);
  if (error) {
    console.error('personal reminder jobs query failed:', error.message);
    return 0;
  }
  let sent = 0;
  for (const job of jobs ?? []) {
    const reminder = job.personal_reminders as { title?: string; due_at?: string; status?: string } | null;
    if (!reminder || reminder.status !== 'active') continue;
    const { data: hostProfile } = await supabase
      .from('profiles')
      .select('full_name, email, notification_email, phone, whatsapp_number, reminder_also')
      .eq('id', job.host_id)
      .maybeSingle();
    const title = (reminder.title || 'your reminder').trim();
    const when = reminder.due_at
      ? new Date(reminder.due_at).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
      : '';
    const msg = `Reminder: ${title}${when ? ` — ${when}` : ''}`;
    let ok = false;
    let recipient = '(none)';
    let err: string | undefined;
    if (job.channel === 'email') {
      const resendKey = Deno.env.get('RESEND_API_KEY');
      const to = (hostProfile?.notification_email || hostProfile?.email || '').trim();
      recipient = to || '(none)';
      if (!resendKey || !to) err = 'no email';
      else ok = await sendResendEmail([to], `Reminder: ${title}`, msg, resendKey);
    } else if (job.channel === 'sms') {
      const to = (hostProfile?.phone || '').trim();
      recipient = to || '(none)';
      if (!to) err = 'no phone';
      else {
        const result = await sendTwilioSms(to, msg);
        ok = result.ok;
        err = result.error;
      }
    } else if (job.channel === 'whatsapp') {
      const to = (hostProfile?.whatsapp_number || hostProfile?.phone || '').trim();
      recipient = to || '(none)';
      if (!to) err = 'no phone';
      else {
        const result = await sendTwilioWhatsapp(to, {
          guest_name: hostProfile?.full_name || 'there',
          host_name: 'PinOnIt',
          service_name: title,
          date: when || 'your scheduled time',
          time: when || '',
          duration: '',
        });
        ok = result.ok;
        err = result.error;
      }
    } else if (job.channel === 'voice') {
      const to = (hostProfile?.phone || '').trim();
      recipient = to || '(none)';
      if (!to) err = 'no phone';
      else {
        const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="Polly.Joanna">This is a PinOnIt reminder. ${title.replace(/[<>&]/g, ' ')}. ${when ? `Scheduled for ${when}.` : ''}</Say></Response>`;
        const result = await sendTwilioVoice(to, twiml);
        ok = result.ok;
        err = result.error;
      }
    }
    await supabase
      .from('personal_reminder_jobs')
      .update({ sent_at: new Date().toISOString(), error: ok ? null : (err || 'send failed') })
      .eq('id', job.id);
    await insertMessageLog(supabase, {
      host_id: job.host_id,
      channel: job.channel,
      status: ok ? 'sent' : 'failed',
      recipient,
      subject: `personal:${job.id}`,
      body: err ? `${msg}\n\n${err}` : msg,
    });
    if (ok) sent++;
    if (job.channel !== 'voice') {
      const due = reminder.due_at ? new Date(reminder.due_at) : null;
      sent += await sendAlsoCopies({
        supabase,
        hostId: job.host_id,
        channel: job.channel,
        people: parseAlsoPeople(hostProfile?.reminder_also),
        dedupeKey: `personal:${job.id}`,
        emailSubject: `Copy: Reminder: ${title}`,
        hostName: hostProfile?.full_name || 'PinOnIt',
        serviceName: title,
        guestName: hostProfile?.full_name || '',
        date: due
          ? due.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
          : when,
        time: due
          ? due.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
          : '',
      });
    }
  }
  return sent;
}

async function hostIdFromJwt(req: Request, supabase: SupabaseClient): Promise<string | null> {
  const header = req.headers.get('Authorization') ?? '';
  const token = header.replace(/^Bearer\s+/i, '').trim();
  if (!token || token === 'anon') return null;
  const { data } = await supabase.auth.getUser(token);
  return data.user?.id ?? null;
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

type AlsoPerson = {
  id: string;
  name: string;
  email: string;
  phone: string;
  channels: string[];
};

function parseAlsoPeople(raw: unknown): AlsoPerson[] {
  if (!Array.isArray(raw)) return [];
  const out: AlsoPerson[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const channels = Array.isArray(row.channels)
      ? (row.channels as string[]).filter((c) => c === 'email' || c === 'sms' || c === 'whatsapp')
      : [];
    out.push({
      id: typeof row.id === 'string' && row.id ? row.id : `p${out.length}`,
      name: String(row.name || '').trim() || 'there',
      email: String(row.email || '').trim(),
      phone: String(row.phone || '').trim(),
      channels,
    });
  }
  return out;
}

function alsoCopyBody(opts: {
  personName: string;
  hostName: string;
  title: string;
  guestName?: string;
  when: string;
  meetLink?: string | null;
}): string {
  const who = opts.guestName ? ` with ${opts.guestName}` : '';
  const join = opts.meetLink ? `\nJoin: ${opts.meetLink}` : '';
  return `Hi ${opts.personName}, ${opts.hostName} wanted you reminded: ${opts.title}${who} — ${opts.when}.${join}\n— PinOnIt`;
}

async function sendAlsoCopies(opts: {
  supabase: SupabaseClient;
  hostId: string;
  bookingId?: string | null;
  channel: string;
  people: AlsoPerson[];
  dedupeKey: string;
  emailSubject: string;
  hostName: string;
  serviceName: string;
  guestName: string;
  date: string;
  time: string;
  meetLink?: string | null;
}): Promise<number> {
  const { channel, people } = opts;
  if (channel === 'voice') return 0;
  const when = `${opts.date} at ${opts.time}`;
  let sent = 0;
  for (const person of people) {
    if (!person.channels.includes(channel)) continue;
    const dedupe = `also:${opts.dedupeKey}:${person.id}:${channel}`;
    if (opts.bookingId && await alreadyLogged(opts.supabase, opts.bookingId, channel, dedupe)) {
      continue;
    }
    const body = alsoCopyBody({
      personName: person.name,
      hostName: opts.hostName,
      title: opts.serviceName,
      guestName: opts.guestName,
      when,
      meetLink: opts.meetLink,
    });
    let ok = false;
    let recipient = '(none)';
    let err: string | undefined;
    if (channel === 'email') {
      const resendKey = Deno.env.get('RESEND_API_KEY');
      recipient = person.email || '(none)';
      if (!resendKey || !person.email) err = 'no email';
      else ok = await sendResendEmail([person.email], opts.emailSubject, body, resendKey);
    } else if (channel === 'sms') {
      recipient = person.phone || '(none)';
      if (!person.phone) err = 'no phone';
      else {
        const result = await sendTwilioSms(person.phone, body);
        ok = result.ok;
        err = result.error;
      }
    } else if (channel === 'whatsapp') {
      recipient = person.phone || '(none)';
      if (!person.phone) err = 'no phone';
      else {
        const result = await sendTwilioWhatsapp(person.phone, {
          guest_name: person.name,
          host_name: opts.hostName,
          service_name: opts.serviceName,
          date: opts.date,
          time: opts.time,
          duration: '',
        });
        ok = result.ok;
        err = result.error;
      }
    }
    await insertMessageLog(opts.supabase, {
      booking_id: opts.bookingId ?? null,
      host_id: opts.hostId,
      channel,
      status: ok ? 'sent' : 'failed',
      recipient,
      subject: dedupe,
      body: err ? `${body}\n\n${err}` : body,
    });
    if (ok) sent++;
  }
  return sent;
}

async function dispatchScheduledReminders(supabase: SupabaseClient): Promise<number> {
  const now = Date.now();
  const lateWindowMs = 25 * 60 * 1000;
  const lookAheadMs = 50 * 60 * 60 * 1000;
  const fromIso = new Date(now - lateWindowMs).toISOString();
  const toIso = new Date(now + lookAheadMs).toISOString();

  const { data: bookings, error } = await supabase
    .from('bookings')
    .select('id, host_id, service_id, guest_name, guest_email, guest_phone, notify_via, reminder_times, reminder_channels, start_time, status, meet_link, guest_timezone, action_token, services(name, duration_minutes), profiles(full_name, slug, timezone, email, notification_email, phone, whatsapp_number, sms_opt_in, whatsapp_opt_in, default_reminder_channel, reminder_also, slack_webhook_url)')
    .in('status', ['confirmed', 'pending', 'pending_approval'])
    .gte('start_time', fromIso)
    .lte('start_time', toIso)
    .limit(300);

  if (error) {
    console.error('dispatch_scheduled bookings query failed:', error.message);
    return 0;
  }

  let sent = 0;
  const hostRulesCache = new Map<string, Array<{
    id: string;
    template_id: string;
    timing_offset_minutes: number;
    service_id: string | null;
    message_templates: {
      id: string;
      channel: string;
      subject: string | null;
      body: string;
      type: string;
    } | null;
  }>>();

  for (const booking of bookings ?? []) {
    const startMs = Date.parse(booking.start_time);
    if (!Number.isFinite(startMs)) continue;
    const hostProfile = booking.profiles as Record<string, unknown> | null;
    const service = booking.services as Record<string, unknown> | null;
    const hostName = (hostProfile?.full_name as string) || 'Your host';
    const serviceName = (service?.name as string) || 'Appointment';
    const dateStr = new Date(booking.start_time).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    const timeStr = new Date(booking.start_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    const duration = `${service?.duration_minutes ?? 30} min`;
    const meetLink = booking.meet_link as string | null;
    const hostPhone = (hostProfile?.phone as string) || null;
    const hostWhatsapp = (hostProfile?.whatsapp_number as string) || hostPhone;
    const alsoPeople = parseAlsoPeople(hostProfile?.reminder_also);
    const rescheduleLink = await ensureRescheduleLink(supabase, booking.id);
    const actionLinks = {
      booking_link: hostProfile?.slug ? `${APP_PUBLIC_URL}/${hostProfile.slug}` : '',
      cancel_link: booking.action_token ? `${APP_PUBLIC_URL}/booking/${booking.id}/cancel/${booking.action_token}` : '',
      confirm_link: booking.action_token ? `${APP_PUBLIC_URL}/booking/${booking.id}/confirm/${booking.action_token}` : '',
      reschedule_link: rescheduleLink,
    };

    if (!hostRulesCache.has(booking.host_id)) {
      const { data: rules } = await supabase
        .from('reminder_rules')
        .select('id, template_id, timing_offset_minutes, service_id, message_templates(id, channel, subject, body, type)')
        .eq('host_id', booking.host_id)
        .eq('is_active', true);
      hostRulesCache.set(booking.host_id, (rules ?? []) as typeof hostRulesCache extends Map<string, infer T> ? T : never);
    }
    const rules = (hostRulesCache.get(booking.host_id) ?? []).filter(
      (r) => !r.service_id || r.service_id === booking.service_id,
    );

    for (const rule of rules) {
      const offset = rule.timing_offset_minutes;
      if (offset === 0) continue;
      const fireAt = startMs + offset * 60 * 1000;
      if (fireAt > now || now - fireAt > lateWindowMs) continue;
      const tplRaw = rule.message_templates as unknown;
      const tpl = (Array.isArray(tplRaw) ? tplRaw[0] : tplRaw) as {
        id: string;
        channel: string;
        subject: string | null;
        body: string;
        type: string;
      } | null;
      if (!tpl) continue;
      const channel = tpl.channel === 'both' ? 'email' : tpl.channel;
      const dedupe = `rule:${rule.id}`;
      if (await alreadyLogged(supabase, booking.id, channel, dedupe)) continue;

      const templateData: TemplateData = {
        guest_name: booking.guest_name,
        host_name: hostName,
        service_name: serviceName,
        date: dateStr,
        time: timeStr,
        timezone: booking.guest_timezone ?? (hostProfile?.timezone as string) ?? 'UTC',
        duration,
        ...actionLinks,
      };
      const msgBody = withChangeThisLink(fillTemplate(tpl.body, templateData), rescheduleLink);
      const subject = tpl.subject ? fillTemplate(tpl.subject, templateData) : dedupe;
      const delivered = await deliverChannel({
        supabase,
        channel,
        booking,
        hostProfile,
        hostPhone,
        hostWhatsapp,
        msgBody,
        emailSubject: subject,
        meetLink,
      });
      if (delivered.ok) sent++;
      await insertMessageLog(supabase, {
        booking_id: booking.id,
        host_id: booking.host_id,
        template_id: tpl.id,
        channel,
        status: delivered.ok ? 'sent' : 'failed',
        recipient: delivered.to || '(none)',
        subject: dedupe,
        body: delivered.error ? `${msgBody}\n\n${delivered.error}` : msgBody,
      });
      if (channel === 'email' || channel === 'sms') {
        await notifySlackWebhook(hostProfile?.slack_webhook_url, msgBody);
      }
      sent += await sendAlsoCopies({
        supabase,
        hostId: booking.host_id,
        bookingId: booking.id,
        channel,
        people: alsoPeople,
        dedupeKey: dedupe,
        emailSubject: `Copy: ${subject}`,
        hostName,
        serviceName,
        guestName: booking.guest_name,
        date: dateStr,
        time: timeStr,
        meetLink,
      });
    }

    const times = Array.isArray(booking.reminder_times) ? booking.reminder_times as string[] : [];
    const channels = Array.isArray(booking.reminder_channels) ? booking.reminder_channels as string[] : [];
    for (const timeId of times) {
      const offset = GUEST_REMINDER_TIME_OFFSETS[timeId];
      if (typeof offset !== 'number') continue;
      const fireAt = startMs + offset * 60 * 1000;
      if (fireAt > now || now - fireAt > lateWindowMs) continue;
      for (const channel of channels.filter((c) => c === 'sms' || c === 'whatsapp' || c === 'email')) {
        const dedupe = `guest:${timeId}:${channel}`;
        if (await alreadyLogged(supabase, booking.id, channel, dedupe)) continue;
        const msgBody = withChangeThisLink(
          `Hi ${booking.guest_name}, reminder: you have a ${duration} ${serviceName} with ${hostName} on ${dateStr} at ${timeStr}.${meetLink ? ` Join: ${meetLink}` : ''} — PinOnIt`,
          rescheduleLink,
        );
        const delivered = await deliverChannel({
          supabase,
          channel,
          booking,
          hostProfile,
          hostPhone,
          hostWhatsapp,
          msgBody,
          emailSubject: `Reminder: ${serviceName} (${timeId})`,
          meetLink,
        });
        if (delivered.ok) sent++;
        await insertMessageLog(supabase, {
          booking_id: booking.id,
          host_id: booking.host_id,
          channel,
          status: delivered.ok ? 'sent' : 'failed',
          recipient: delivered.to || '(none)',
          subject: dedupe,
          body: delivered.error ? `${msgBody}\n\n${delivered.error}` : msgBody,
        });
        if (channel === 'email' || channel === 'sms') {
          await notifySlackWebhook(hostProfile?.slack_webhook_url, msgBody);
        }
        sent += await sendAlsoCopies({
          supabase,
          hostId: booking.host_id,
          bookingId: booking.id,
          channel,
          people: alsoPeople,
          dedupeKey: dedupe,
          emailSubject: `Copy: Reminder: ${serviceName}`,
          hostName,
          serviceName,
          guestName: booking.guest_name,
          date: dateStr,
          time: timeStr,
          meetLink,
        });
      }
    }
  }

  return sent;
}

async function deliverChannel(opts: {
  supabase: SupabaseClient;
  channel: string;
  booking: Record<string, unknown>;
  hostProfile: Record<string, unknown> | null;
  hostPhone: string | null;
  hostWhatsapp: string | null;
  msgBody: string;
  emailSubject: string;
  meetLink: string | null;
}): Promise<{ ok: boolean; to: string | null; error?: string }> {
  const { channel, booking, hostProfile, msgBody, emailSubject } = opts;
  if (channel === 'email') {
    const resendKey = Deno.env.get('RESEND_API_KEY');
    const to = (booking.guest_email as string) || null;
    if (!resendKey) return { ok: false, to, error: 'email not configured' };
    if (!to) return { ok: false, to: null, error: 'no guest email' };
    const ok = await sendResendEmail([to], emailSubject, msgBody, resendKey);
    return { ok, to, error: ok ? undefined : 'email send failed' };
  }
  if (channel === 'sms') {
    const to = bookingAllowsGuestSms({
      guest_phone: booking.guest_phone as string | null,
      notify_via: booking.notify_via,
    })
      ? (booking.guest_phone as string)
      : null;
    if (!to) return { ok: false, to: null, error: 'no SMS recipient' };
    const result = await sendTwilioSms(to, msgBody);
    return { ok: result.ok, to, error: result.error };
  }
  if (channel === 'whatsapp') {
    const to = bookingAllowsGuestWhatsapp({
      guest_phone: booking.guest_phone as string | null,
      notify_via: booking.notify_via,
    })
      ? (booking.guest_phone as string)
      : null;
    if (!to) return { ok: false, to: null, error: 'no WhatsApp recipient' };
    const result = await sendTwilioWhatsapp(to, whatsappVarsFromBooking(booking, hostProfile));
    return { ok: result.ok, to, error: result.error };
  }
  return { ok: false, to: null, error: `unsupported channel ${channel}` };
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
      const actorId = await hostIdFromJwt(req, supabase);
      if (!actorId && !isServiceRoleRequest(req)) {
        return jsonAuthError(corsHeaders);
      }
      const { data: booking } = await supabase
        .from('bookings')
        .select('guest_email, guest_name, host_id')
        .eq('id', body.booking_id)
        .maybeSingle();
      if (!booking?.guest_email) {
        return jsonResponse({ error: 'Booking or guest email not found' }, 404);
      }
      if (actorId && actorId !== booking.host_id) {
        return jsonAuthError(corsHeaders, 'Not your booking');
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

    // ── Test Slack incoming webhook ──────────────────────────────────────────
    if (body.test_slack) {
      const hostId = await hostIdFromJwt(req, supabase);
      if (!hostId) return jsonAuthError(corsHeaders, 'Sign in to send a Slack test');
      const raw = typeof body.slack_webhook_url === 'string' ? body.slack_webhook_url.trim() : '';
      let url = raw;
      if (!url) {
        const { data: hp } = await supabase
          .from('profiles')
          .select('slack_webhook_url')
          .eq('id', hostId)
          .maybeSingle();
        url = (hp?.slack_webhook_url || '').trim();
      }
      if (!isValidSlackWebhookUrl(url)) {
        return jsonResponse({ error: 'Slack webhook must look like https://hooks.slack.com/services/…' }, 400);
      }
      const text = typeof body.text === 'string' && body.text.trim()
        ? body.text.trim()
        : 'PinOnIt test: Slack notifications are working.';
      await notifySlackWebhook(url, text);
      return jsonResponse({ success: true });
    }

    // ── Test SMS / WhatsApp ──────────────────────────────────────────────────
    if (body.test_sms || body.test_whatsapp || body.test_voice) {
      const { to, guest_name, host_name, duration, date, time, meeting_link } = body;
      if (!to) return jsonResponse({ error: 'Missing to phone number' }, 400);
      const channel = body.test_voice ? 'voice' : body.test_whatsapp ? 'whatsapp' : 'sms';
      const hostId = await hostIdFromJwt(req, supabase);
      if (!hostId) return jsonAuthError(corsHeaders, 'Sign in to send a test message');

      const twilioSid = Deno.env.get('TWILIO_ACCOUNT_SID');
      if (!twilioSid) {
        return jsonResponse({ error: 'Twilio credentials are not configured on this account.' }, 503);
      }

      const msg = [
        `PinOnIt test ${channel === 'whatsapp' ? 'WhatsApp' : channel === 'voice' ? 'voice' : 'SMS'}: Hi ${guest_name ?? 'Guest'}, reminder: you have a ${duration ?? '30'} min meeting with ${host_name ?? 'your host'} on ${date ?? 'your scheduled date'} at ${time ?? 'your scheduled time'}.`,
        meeting_link ? `Join: ${meeting_link}` : '',
        '— PinOnIt',
      ].filter(Boolean).join(' ');

      const voiceLine = `This is a PinOnIt test reminder. You have a test meeting with ${host_name ?? 'your host'}. This is only a test.`;
      const result = channel === 'whatsapp'
        ? await sendTwilioWhatsapp(to, {
            guest_name: guest_name ?? 'Test Guest',
            host_name: host_name ?? 'your host',
            service_name: 'test meeting',
            date: date ?? 'your scheduled date',
            time: time ?? 'your scheduled time',
            duration: duration ? `${duration} min` : '30 min',
          }, { waitForStatus: true })
        : channel === 'voice'
          ? await sendTwilioVoice(to, buildCustomVoiceTwiml(voiceLine))
          : await sendTwilioSms(to, msg);

      if (hostId) {
        await insertMessageLog(supabase, {
          host_id: hostId,
          channel,
          status: result.ok ? 'sent' : 'failed',
          recipient: to,
          subject: channel === 'whatsapp' ? 'Test WhatsApp' : channel === 'voice' ? 'Test voicemail' : 'Test SMS',
          body: result.ok ? (channel === 'voice' ? voiceLine : msg) : `${channel === 'voice' ? voiceLine : msg}\n\nError: ${result.error ?? 'send failed'}`,
        });
      }

      if (!result.ok) return jsonResponse({ error: result.error }, 502);
      return jsonResponse({ success: true, to, channel });
    }

    // ── Extra event reminders (click-to-remind overrides) ────────────────────
    if (body.dispatch_event_overrides) {
      if (!isServiceRoleRequest(req)) {
        return jsonAuthError(corsHeaders, 'Dispatcher requires a service role token');
      }
      const now = Date.now();
      const windowMs = 30 * 60 * 1000;
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
        let hostSmsConsent = false;
        let hostWhatsappConsent = false;
        let hostName = 'PinOnIt';
        let meetLink: string | null = null;
        let alsoPeople: AlsoPerson[] = [];
        let slackWebhook: string | null = null;

        if (ov.booking_id) {
          const { data: booking } = await supabase
            .from('bookings')
            .select('guest_name, guest_email, guest_phone, notify_via, start_time, status, meet_link, services(name), profiles(full_name, email, notification_email, phone, whatsapp_number, sms_opt_in, whatsapp_opt_in, default_reminder_channel, reminder_also, slack_webhook_url)')
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
          hostSmsConsent = hostAllowsSms(hp);
          hostWhatsappConsent = hostAllowsWhatsapp(hp);
          alsoPeople = parseAlsoPeople(hp?.reminder_also);
          slackWebhook = (hp?.slack_webhook_url as string) || null;
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
            .select('full_name, email, notification_email, phone, whatsapp_number, sms_opt_in, whatsapp_opt_in, default_reminder_channel, reminder_also, slack_webhook_url')
            .eq('id', ov.host_id)
            .maybeSingle();
          hostName = hp?.full_name || hostName;
          hostEmail = hp?.notification_email || hp?.email || null;
          hostPhone = hp?.phone || null;
          hostWhatsapp = hp?.whatsapp_number || hostPhone;
          hostSmsConsent = hostAllowsSms(hp);
          hostWhatsappConsent = hostAllowsWhatsapp(hp);
          guestName = hostName;
          alsoPeople = parseAlsoPeople(hp?.reminder_also);
          slackWebhook = hp?.slack_webhook_url || null;
        }

        if (!startIso) continue;
        const fireAt = new Date(startIso).getTime() + offsetMs;
        if (fireAt > now || now - fireAt > windowMs) continue;

        const when = new Date(startIso);
        const dateStr = when.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
        const timeStr = when.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
        const msg = (ov.message as string)?.trim() ||
          `Reminder: ${title}${guestName ? ` with ${guestName}` : ''} on ${dateStr} at ${timeStr}.`;
        const rescheduleLink = ov.booking_id ? await ensureRescheduleLink(supabase, ov.booking_id) : '';
        const withLink = withChangeThisLink(
          meetLink ? `${msg}\nJoin: ${meetLink}` : msg,
          rescheduleLink,
        );

        let recipient: string | null = null;
        let status: 'sent' | 'failed' | 'skipped' = 'skipped';
        let errorText = '';

        if (ov.channel === 'email') {
          const resendKey = Deno.env.get('RESEND_API_KEY');
          recipient = guestEmail || hostEmail;
          if (resendKey && recipient) {
            const ok = await sendResendEmail([recipient], `Reminder: ${title}`, withLink, resendKey);
            status = ok ? 'sent' : 'failed';
            if (ok) sent++;
            else errorText = 'email send failed';
          } else {
            errorText = recipient ? 'email not configured' : 'no email recipient';
          }
        } else if (ov.channel === 'sms') {
          recipient = bookingAllowsGuestSms({ guest_phone: guestPhone, notify_via: notifyVia })
            ? guestPhone
            : null;
          if (recipient) {
            const result = await sendTwilioSms(recipient, withLink);
            status = result.ok ? 'sent' : 'failed';
            errorText = result.error ?? '';
            if (result.ok) sent++;
          } else {
            errorText = 'no SMS recipient (guest did not opt in)';
          }
        } else if (ov.channel === 'whatsapp') {
          recipient = bookingAllowsGuestWhatsapp({ guest_phone: guestPhone, notify_via: notifyVia })
            ? guestPhone
            : null;
          if (recipient) {
            const start = startIso ? new Date(startIso) : null;
            const startOk = start !== null && !Number.isNaN(start.getTime());
            const result = await sendTwilioWhatsapp(recipient, {
              guest_name: guestName || 'Guest',
              host_name: hostName,
              service_name: title,
              date: startOk
                ? start.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
                : 'your scheduled date',
              time: startOk
                ? start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
                : 'your scheduled time',
            });
            status = result.ok ? 'sent' : 'failed';
            errorText = result.error ?? '';
            if (result.ok) sent++;
          } else {
            errorText = 'no WhatsApp recipient (guest did not opt in and host has no number)';
          }
        }

        if (ov.host_id) {
          await insertMessageLog(supabase, {
            booking_id: ov.booking_id,
            host_id: ov.host_id,
            channel: ov.channel,
            status: status === 'sent' ? 'sent' : 'failed',
            recipient: recipient || '(none)',
            subject: `Extra reminder (${ov.offset_minutes ?? -60} min)`,
            body: errorText ? `${withLink}\n\n${errorText}` : withLink,
          });
        }

        if (ov.channel === 'email' || ov.channel === 'sms') {
          await notifySlackWebhook(slackWebhook, withLink);
        }

        sent += await sendAlsoCopies({
          supabase,
          hostId: ov.host_id,
          bookingId: ov.booking_id,
          channel: ov.channel,
          people: alsoPeople,
          dedupeKey: `extra:${ov.id}`,
          emailSubject: `Copy: Reminder: ${title}`,
          hostName,
          serviceName: title,
          guestName,
          date: dateStr,
          time: timeStr,
          meetLink,
        });

        await supabase
          .from('event_reminder_overrides')
          .update({ sent_at: new Date().toISOString() })
          .eq('id', ov.id);
      }

      if (body.dispatch_scheduled) {
        const scheduled = await dispatchScheduledReminders(supabase);
        const personal = await dispatchPersonalReminders(supabase);
        sent += scheduled + personal;
      }

      return jsonResponse({ success: true, sent });
    }

    if (body.dispatch_scheduled) {
      if (!isServiceRoleRequest(req)) {
        return jsonAuthError(corsHeaders, 'Dispatcher requires a service role token');
      }
      const sent = await dispatchScheduledReminders(supabase);
      const personal = await dispatchPersonalReminders(supabase);
      return jsonResponse({ success: true, sent: sent + personal });
    }

    // ── Normal reminder mode ─────────────────────────────────────────────────
    const { booking_id, template_id, channel, action_token } = body;
    if (!booking_id || !template_id) {
      return jsonResponse({ error: 'Missing booking_id or template_id' }, 400);
    }

    const privileged = isServiceRoleRequest(req);
    const actorId = privileged ? null : await hostIdFromJwt(req, supabase);

    const { data: booking } = await supabase
      .from('bookings')
      .select('*, services(name, duration_minutes), profiles(full_name, slug, timezone, email, notification_email, phone, whatsapp_number, sms_opt_in, whatsapp_opt_in, default_reminder_channel, voice_message_template, slack_webhook_url)')
      .eq('id', booking_id)
      .maybeSingle();

    if (!booking) {
      return jsonResponse({ error: 'Booking not found' }, 404);
    }

    if (!privileged) {
      const tokenOk = typeof action_token === 'string' && action_token.length > 0 && action_token === booking.action_token;
      const hostOk = actorId === booking.host_id;
      if (!tokenOk && !hostOk) {
        return jsonAuthError(corsHeaders, 'Invalid booking token');
      }
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
    const baseUrl = APP_PUBLIC_URL;
    const rescheduleLink = await ensureRescheduleLink(supabase, booking.id);

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
      reschedule_link: rescheduleLink,
    };

    let subject = template.subject ? fillTemplate(template.subject, templateData) : null;
    let msgBody = withChangeThisLink(fillTemplate(template.body, templateData), rescheduleLink);

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
      const smsTo = bookingAllowsGuestSms(booking)
        ? booking.guest_phone
        : null;
      if (!smsTo) {
        console.warn('No SMS recipient (guest opt-in/phone or host phone), booking:', booking_id);
        deliveryStatus = 'failed';
      } else {
        const smsBody = msgBody || [
          `Hi ${templateData.guest_name}, reminder: you have a ${templateData.duration} meeting with ${templateData.host_name} on ${templateData.date} at ${templateData.time}.`,
          booking.meet_link ? `Join: ${booking.meet_link}` : '',
          '— PinOnIt',
        ].filter(Boolean).join(' ');

        const result = await sendTwilioSms(smsTo, smsBody);
        if (!result.ok) {
          console.warn('SMS delivery failed:', result.error);
          deliveryStatus = 'failed';
        }
      }
    }

    if (sendChannel === 'email' || sendChannel === 'sms') {
      await notifySlackWebhook(hostProfile?.slack_webhook_url, msgBody);
    }

    // ── WhatsApp via Twilio ──────────────────────────────────────────────────
    if (sendChannel === 'whatsapp') {
      const waTo = bookingAllowsGuestWhatsapp(booking)
        ? booking.guest_phone
        : null;
      if (!waTo) {
        console.warn('No WhatsApp recipient, booking:', booking_id);
        deliveryStatus = 'failed';
      } else {
        const result = await sendTwilioWhatsapp(waTo, {
          guest_name: templateData.guest_name,
          host_name: templateData.host_name,
          service_name: templateData.service_name,
          date: templateData.date,
          time: templateData.time,
          duration: templateData.duration,
        });
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
          ? (booking.guest_phone ?? (hostProfile?.phone as string) ?? booking.guest_email)
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
