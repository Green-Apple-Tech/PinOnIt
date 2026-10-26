import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { LEAD_ALERT_TOKEN_HEADER, leadAlertFromBotLead } from '../../../shared/leadAlert.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function notifyLeadAlert(payload: { email?: unknown; answers?: unknown; source?: unknown }) {
  const token = Deno.env.get('LEAD_ALERT_TOKEN') ?? '';
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  if (!token || !supabaseUrl) {
    console.error('save-bot-lead skipped lead-alert: LEAD_ALERT_TOKEN is not set');
    return;
  }
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/lead-alert`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        [LEAD_ALERT_TOKEN_HEADER]: token,
      },
      body: JSON.stringify(leadAlertFromBotLead(payload)),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      console.error('lead-alert returned', res.status);
    }
  } catch (err) {
    console.error('lead-alert call failed:', err);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { email, answers, source } = await req.json();

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { error } = await supabase
      .from('bot_leads')
      .insert({ email: email || null, answers: answers ?? {}, source: source ?? 'onboarding_bot' });

    if (error) throw error;

    await notifyLeadAlert({ email, answers, source });

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
