import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { isServiceRoleRequest, jsonAuthError } from '../_shared/callerAuth.ts';
import { sendTwilioSmsGuarded } from '../_shared/sms-send-gate.ts';
import { expireStaleTrials, hostPlanIsActive } from '../_shared/hostPlan.ts';
import { normalizePhoneE164 } from '../_shared/phone.ts';
import { logHostSmsUsage } from '../_shared/messageLog.ts';
import {
  nextDueQuoteFollowupDay,
  normalizeQuoteFollowupDays,
  quoteFollowupEligible,
  quoteFollowupSms,
  quoteTotalsFromLines,
} from '../_shared/quoteSms.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey, x-cron-secret',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function businessNameFromProfile(profile: {
  business_name?: string | null;
  full_name?: string | null;
  paid_booking_settings?: unknown;
} | null) {
  const settings = (profile?.paid_booking_settings ?? {}) as Record<string, unknown>;
  return (
    (typeof profile?.business_name === 'string' && profile.business_name.trim())
    || (typeof settings.display_name === 'string' && settings.display_name.trim())
    || (typeof profile?.full_name === 'string' && profile.full_name.trim())
    || 'PinOnIt'
  );
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ ok: false, error: 'Method not allowed' }, 405);
  if (!isServiceRoleRequest(req)) return jsonAuthError(corsHeaders, 'Dispatcher requires a service role token');

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!supabaseUrl || !serviceRoleKey) return json({ ok: false, error: 'Server is not configured' }, 500);

  const admin = createClient(supabaseUrl, serviceRoleKey);
  await expireStaleTrials(admin);

  const appUrl = (Deno.env.get('APP_URL') || 'https://pinonit.com').replace(/\/$/, '');
  const cutoff = new Date(Date.now() - 45 * 86400000).toISOString();

  const { data: rows, error } = await admin
    .from('documents')
    .select('id, token, sender_id, recipient_phone, topic, status, created_at, valid_until, line_items, tax_percent, quote_followup_sent_days')
    .eq('document_type', 'quote')
    .in('status', ['pending', 'viewed'])
    .gte('created_at', cutoff)
    .limit(400);

  if (error) {
    console.error('dispatch-quote-reminders query', error.message);
    return json({ ok: false, error: error.message }, 500);
  }

  const docs = (rows ?? []).filter((d) => quoteFollowupEligible(d));
  const hostIds = [...new Set(docs.map((d) => d.sender_id).filter(Boolean))];
  const { data: profiles } = hostIds.length
    ? await admin
      .from('profiles')
      .select('id, business_name, full_name, paid_booking_settings, quote_followup_enabled, quote_followup_days')
      .in('id', hostIds)
    : { data: [] as Record<string, unknown>[] };

  const profileById = new Map((profiles ?? []).map((p) => [p.id as string, p]));
  const planCache = new Map<string, boolean>();

  let sent = 0;
  let skipped = 0;

  for (const doc of docs) {
    const profile = profileById.get(doc.sender_id as string);
    if (!profile || profile.quote_followup_enabled === false) {
      skipped += 1;
      continue;
    }

    const intervals = normalizeQuoteFollowupDays(profile.quote_followup_days);
    const dueDay = nextDueQuoteFollowupDay({
      createdAt: doc.created_at as string,
      alreadySent: Array.isArray(doc.quote_followup_sent_days) ? doc.quote_followup_sent_days as number[] : [],
      intervals,
    });
    if (dueDay == null) continue;

    let planOk = planCache.get(doc.sender_id as string);
    if (planOk === undefined) {
      planOk = await hostPlanIsActive(admin, doc.sender_id as string);
      planCache.set(doc.sender_id as string, planOk);
    }
    if (!planOk) {
      skipped += 1;
      continue;
    }

    const to = normalizePhoneE164(doc.recipient_phone as string | null);
    if (!to) {
      skipped += 1;
      continue;
    }

    const already = Array.isArray(doc.quote_followup_sent_days) ? [...doc.quote_followup_sent_days as number[]] : [];
    if (already.includes(dueDay)) continue;
    const nextSent = [...already, dueDay].sort((a, b) => a - b);

    const { data: claimed, error: claimErr } = await admin
      .from('documents')
      .update({ quote_followup_sent_days: nextSent })
      .eq('id', doc.id)
      .in('status', ['pending', 'viewed'])
      .select('id, status, valid_until')
      .maybeSingle();
    if (claimErr || !claimed) {
      skipped += 1;
      continue;
    }
    if (!quoteFollowupEligible(claimed)) {
      await admin
        .from('documents')
        .update({ quote_followup_sent_days: already })
        .eq('id', doc.id);
      skipped += 1;
      continue;
    }

    const total = quoteTotalsFromLines(
      Array.isArray(doc.line_items) ? doc.line_items as { amount?: number }[] : [],
      Number(doc.tax_percent) || 0,
    );
    const link = `${appUrl}/d/${doc.token}`;
    const body = quoteFollowupSms({
      businessName: businessNameFromProfile(profile),
      topic: String(doc.topic || '').trim() || 'your job',
      total,
      link,
    });

    const sms = await sendTwilioSmsGuarded(admin, to, body);
    await logHostSmsUsage(admin, {
      hostId: doc.sender_id as string,
      recipient: to,
      subject: 'Quote follow-up',
      body,
      status: sms.ok ? 'sent' : 'failed',
    });
    if (sms.ok) {
      sent += 1;
      continue;
    }
    if (sms.skipped !== 'opted_out') {
      await admin
        .from('documents')
        .update({ quote_followup_sent_days: already })
        .eq('id', doc.id);
    }
    skipped += 1;
  }

  return json({ ok: true, sent, skipped });
});
