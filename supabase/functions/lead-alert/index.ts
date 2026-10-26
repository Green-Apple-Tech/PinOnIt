import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { sendTwilioSmsFromNumber } from '../_shared/sms-send-gate.ts';
import {
  LEAD_ALERT_TOKEN_HEADER,
  formatLeadAlertMessage,
  normalizeAlertPhone,
  parseLeadAlertInput,
  secretsMatch,
} from '../../../shared/leadAlert.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': `Content-Type, Authorization, apikey, ${LEAD_ALERT_TOKEN_HEADER}`,
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json({ error: 'method_not_allowed' }, 405);
  }

  const expected = Deno.env.get('LEAD_ALERT_TOKEN') ?? '';
  const alertPhone = normalizeAlertPhone(Deno.env.get('LEAD_ALERT_PHONE'));
  if (!expected || !alertPhone) {
    console.error('lead-alert missing LEAD_ALERT_TOKEN or LEAD_ALERT_PHONE');
    return json({ error: 'not_configured' }, 503);
  }

  const provided = req.headers.get(LEAD_ALERT_TOKEN_HEADER) ?? '';
  if (!provided || !secretsMatch(provided, expected)) {
    return json({ error: 'unauthorized' }, 401);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }

  const parsed = parseLeadAlertInput(body);
  if (!parsed.ok) {
    return json({ error: parsed.error }, 400);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!supabaseUrl || !serviceKey) {
    console.error('lead-alert missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    return json({ error: 'not_configured' }, 503);
  }

  const message = formatLeadAlertMessage(parsed.value);
  const supabase = createClient(supabaseUrl, serviceKey);
  const result = await sendTwilioSmsFromNumber(supabase, alertPhone, message, { appendOptOut: false });
  if (!result.ok) {
    console.error('lead-alert SMS failed:', result.skipped ?? result.error);
    const status = result.skipped === 'not_configured' ? 503 : 502;
    return json({ error: 'sms_failed', skipped: result.skipped ?? null }, status);
  }

  return json({ ok: true });
});
