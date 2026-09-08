import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { sendTwilioSmsGuarded } from '../_shared/sms-send-gate.ts';
import { hostIdFromJwt, jsonAuthError } from '../_shared/callerAuth.ts';
import { normalizePhoneE164 } from '../_shared/phone.ts';
import { expireStaleTrials, hostPlanIsActive } from '../_shared/hostPlan.ts';
import { quoteLinkSms, quoteTotalsFromLines, receiptLinkSms } from '../_shared/quoteSms.ts';

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

  let payload: { token?: string; signingUrl?: string; purpose?: string };
  try {
    payload = await req.json();
  } catch {
    return json({ ok: false, error: 'Invalid JSON' }, 400);
  }

  const token = payload.token?.trim();
  const signingUrl = payload.signingUrl?.trim();
  const purpose = payload.purpose === 'quote' || payload.purpose === 'receipt' ? payload.purpose : 'link';
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
    .select('id, recipient_name, recipient_phone, topic, document_type, document_type_custom, token, pay_elsewhere_url, line_items, tax_percent')
    .eq('token', token)
    .eq('sender_id', hostId)
    .maybeSingle();

  if (error || !doc) return json({ ok: false, error: 'Document not found' }, 404);

  const to = normalizePhoneE164(doc.recipient_phone);
  if (!to) return json({ ok: false, error: 'Recipient phone number is not valid' });

  const { data: profile } = await admin
    .from('profiles')
    .select('business_name, full_name, paid_booking_settings')
    .eq('id', hostId)
    .maybeSingle();
  const settings = (profile?.paid_booking_settings ?? {}) as Record<string, unknown>;
  const businessName =
    (typeof profile?.business_name === 'string' && profile.business_name.trim())
    || (typeof settings.display_name === 'string' && settings.display_name.trim())
    || (typeof profile?.full_name === 'string' && profile.full_name.trim())
    || 'PinOnIt';

  const kind =
    doc.document_type === 'other' && doc.document_type_custom?.trim()
      ? doc.document_type_custom.trim()
      : String(doc.document_type || 'document').replaceAll('_', ' ');
  const topicBit = doc.topic ? ` regarding ${doc.topic}` : '';
  const payBit = typeof doc.pay_elsewhere_url === 'string' && doc.pay_elsewhere_url.trim()
    ? ` Pay: ${doc.pay_elsewhere_url.trim()}`
    : '';

  const quoteLike = doc.document_type === 'quote' || purpose === 'quote' || purpose === 'receipt';
  const total = quoteTotalsFromLines(
    Array.isArray(doc.line_items) ? doc.line_items as { amount?: number }[] : [],
    Number(doc.tax_percent) || 0,
  );
  const shortDescription = String(doc.topic || '').trim() || kind;

  let body: string;
  if (purpose === 'receipt' || (purpose === 'link' && doc.document_type === 'receipt')) {
    body = receiptLinkSms({ businessName, shortDescription, total, link: signingUrl });
  } else if (quoteLike && doc.document_type === 'quote') {
    body = quoteLinkSms({ businessName, shortDescription, total, link: signingUrl });
  } else {
    body = `Hi ${doc.recipient_name}, you have a ${kind}${topicBit} to review: ${signingUrl}${payBit}`;
  }

  const sms = await sendTwilioSmsGuarded(admin, to, body);
  if (!sms.ok) {
    if (sms.skipped === 'opted_out') {
      return json({ ok: false, error: 'Recipient opted out of SMS (STOP).' }, 403);
    }
    return json({ ok: false, error: sms.error });
  }
  return json({ ok: true });
});
