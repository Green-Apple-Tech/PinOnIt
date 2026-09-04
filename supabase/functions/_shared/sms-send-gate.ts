/** Shared SMS/WhatsApp send gate: STOP registry + Twilio send. */

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.57.4';
import { appendSmsOptOut } from './sms-opt-out.ts';

export function phoneLast10(phone: string | null | undefined): string | null {
  const digits = (phone || '').replace(/\D/g, '');
  if (digits.length < 10) return null;
  return digits.slice(-10);
}

export async function smsIsOptedOut(
  supabase: SupabaseClient,
  phone: string | null | undefined,
): Promise<boolean> {
  const last10 = phoneLast10(phone);
  if (!last10) return false;
  const { data, error } = await supabase.rpc('sms_is_opted_out', { p_phone: phone });
  if (error) {
    console.error('sms_is_opted_out failed:', error.message);
    // Fail closed for guest transactional SMS when we cannot verify.
    return true;
  }
  return data === true;
}

export type TwilioSendResult = {
  ok: boolean;
  skipped?: 'opted_out' | 'no_phone' | 'not_configured';
  error?: string;
  sid?: string;
};

/** Send SMS only if number is not on the STOP registry. */
export async function sendTwilioSmsGuarded(
  supabase: SupabaseClient,
  to: string | null | undefined,
  body: string,
  opts?: { appendOptOut?: boolean },
): Promise<TwilioSendResult> {
  const phone = (to || '').trim();
  if (!phone) return { ok: false, skipped: 'no_phone', error: 'no phone' };

  if (await smsIsOptedOut(supabase, phone)) {
    return { ok: false, skipped: 'opted_out', error: 'recipient opted out (STOP)' };
  }

  const twilioSid = Deno.env.get('TWILIO_ACCOUNT_SID');
  const twilioToken = Deno.env.get('TWILIO_AUTH_TOKEN');
  const messagingServiceSid = Deno.env.get('TWILIO_MESSAGING_SERVICE_SID');
  if (!twilioSid || !twilioToken || !messagingServiceSid) {
    return { ok: false, skipped: 'not_configured', error: 'SMS is not configured' };
  }

  const text = opts?.appendOptOut === false ? body : appendSmsOptOut(body);
  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: 'Basic ' + btoa(`${twilioSid}:${twilioToken}`),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          MessagingServiceSid: messagingServiceSid,
          To: phone,
          Body: text,
        }),
      },
    );
    if (!res.ok) {
      const err = await res.text();
      console.error('Twilio SMS failed:', err);
      return { ok: false, error: err };
    }
    const json = await res.json() as { sid?: string };
    return { ok: true, sid: json.sid };
  } catch (e) {
    console.error('Twilio SMS error:', e);
    return { ok: false, error: e instanceof Error ? e.message : 'send failed' };
  }
}
