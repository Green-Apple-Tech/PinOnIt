import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { sendTwilioSmsGuarded } from '../_shared/sms-send-gate.ts';
import { hostIdFromJwt, jsonAuthError } from '../_shared/callerAuth.ts';
import { normalizePhoneE164 } from '../_shared/phone.ts';
import { expireStaleTrials, hostPlanIsActive } from '../_shared/hostPlan.ts';

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
    return json({ ok: false, error: 'Reactivate Pro to send documents.' }, 403);
  }

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
    .select('id, recipient_name, recipient_phone, topic, document_type, document_type_custom, token')
    .eq('token', token)
    .eq('sender_id', hostId)
    .maybeSingle();

  if (error || !doc) return json({ ok: false, error: 'Document not found' }, 404);

  const to = normalizePhoneE164(doc.recipient_phone);
  if (!to) return json({ ok: false, error: 'Recipient phone number is not valid' });

  const kind =
    doc.document_type === 'other' && doc.document_type_custom?.trim()
      ? doc.document_type_custom.trim()
      : String(doc.document_type || 'document').replaceAll('_', ' ');
  const topicBit = doc.topic ? ` regarding ${doc.topic}` : '';
  const sms = await sendTwilioSmsGuarded(
    admin,
    to,
    `Hi ${doc.recipient_name}, you have a ${kind}${topicBit} to review: ${signingUrl}`,
  );
  if (!sms.ok) {
    if (sms.skipped === 'opted_out') {
      return json({ ok: false, error: 'Recipient opted out of SMS (STOP).' }, 403);
    }
    return json({ ok: false, error: sms.error });
  }
  return json({ ok: true });
});
