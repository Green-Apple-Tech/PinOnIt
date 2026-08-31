import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { appendSmsOptOut } from '../_shared/sms-opt-out.ts';
import { normalizePhoneE164 } from '../_shared/phone.ts';

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

async function sendTwilioSms(to: string, body: string) {
  const twilioSid = Deno.env.get('TWILIO_ACCOUNT_SID');
  const twilioToken = Deno.env.get('TWILIO_AUTH_TOKEN');
  const messagingServiceSid = Deno.env.get('TWILIO_MESSAGING_SERVICE_SID');
  if (!twilioSid || !twilioToken || !messagingServiceSid) {
    return { ok: false, error: 'SMS is not configured' };
  }
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
        To: to,
        Body: appendSmsOptOut(body),
      }),
    },
  );
  if (!res.ok) {
    return { ok: false, error: await res.text() };
  }
  return { ok: true };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ ok: false, error: 'Method not allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!supabaseUrl || !serviceRoleKey) return json({ ok: false, error: 'Server is not configured' }, 500);

  let payload: { token?: string; force?: boolean };
  try {
    payload = await req.json();
  } catch {
    return json({ ok: false, error: 'Invalid JSON' }, 400);
  }

  const token = payload.token?.trim();
  if (!token) return json({ ok: false, error: 'token is required' }, 400);

  const admin = createClient(supabaseUrl, serviceRoleKey);
  const { data, error } = await admin.rpc('issue_document_otp', {
    p_token: token,
    p_force: Boolean(payload.force),
  });

  const result = (data ?? null) as {
    ok?: boolean;
    error?: string;
    already_verified?: boolean;
    send?: boolean;
    code?: string;
    recipient_name?: string;
    recipient_phone?: string;
  } | null;

  if (error || !result?.ok) {
    return json({ ok: false, error: error?.message ?? result?.error ?? 'Could not issue code' });
  }

  if (result.already_verified || !result.send) {
    return json({ ok: true, already_verified: Boolean(result.already_verified), sent: false });
  }

  const to = normalizePhoneE164(result.recipient_phone ?? '');
  if (!to) return json({ ok: false, error: 'Recipient phone number is not valid' });

  const sms = await sendTwilioSms(
    to,
    `Hi ${result.recipient_name || 'there'}, your PinOnIt verification code is ${result.code}. It expires in 10 minutes.`,
  );
  if (!sms.ok) return json({ ok: false, error: sms.error });
  return json({ ok: true, already_verified: false, sent: true });
});
