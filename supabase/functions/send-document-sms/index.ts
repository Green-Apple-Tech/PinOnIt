import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { appendSmsOptOut } from '../_shared/sms-opt-out.ts';
import { hostIdFromJwt, jsonAuthError } from '../_shared/callerAuth.ts';
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
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  if (!supabaseUrl || !anonKey) return json({ ok: false, error: 'Server is not configured' }, 500);

  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });

  const hostId = await hostIdFromJwt(req, supabase);
  if (!hostId) return jsonAuthError(corsHeaders);

  let payload: { token?: string; signingUrl?: string };
  try {
    payload = await req.json();
  } catch {
    return json({ ok: false, error: 'Invalid JSON' }, 400);
  }

  const token = payload.token?.trim();
  const signingUrl = payload.signingUrl?.trim();
  if (!token || !signingUrl) {
    return json({ ok: false, error: 'token and signingUrl are required' }, 400);
  }

  try {
    const parsed = new URL(signingUrl);
    if (!['http:', 'https:'].includes(parsed.protocol) || !parsed.pathname.includes(`/d/${token}`)) {
      return json({ ok: false, error: 'Invalid signing URL' }, 400);
    }
  } catch {
    return json({ ok: false, error: 'Invalid signing URL' }, 400);
  }

  const { data: doc, error } = await supabase
    .from('documents')
    .select('id, recipient_name, recipient_phone, topic, document_type, token')
    .eq('token', token)
    .eq('sender_id', hostId)
    .maybeSingle();

  if (error || !doc) return json({ ok: false, error: 'Document not found' }, 404);

  const to = normalizePhoneE164(doc.recipient_phone);
  if (!to) return json({ ok: false, error: 'Recipient phone number is not valid' });

  const kind = doc.document_type || 'document';
  const topicBit = doc.topic ? ` regarding ${doc.topic}` : '';
  const sms = await sendTwilioSms(
    to,
    `Hi ${doc.recipient_name}, you have a ${kind}${topicBit} to review: ${signingUrl}`,
  );
  if (!sms.ok) return json({ ok: false, error: sms.error });
  return json({ ok: true });
});
