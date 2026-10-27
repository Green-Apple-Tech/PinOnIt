// Partner sites post reminder signups here. Email jobs are queued by default.
// SMS jobs are queued only after TCPA evidence is stored on sms_optins.
// Rows go to personal_reminders / personal_reminder_jobs, which send-reminder
// already drains. service_reminders are shared per-service rules, so this
// function does not write them.
import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { hostPlanIsActive } from '../_shared/hostPlan.ts';
import {
  buildIntakeTranscript,
  intakeNoteLine,
  intakeRateLimited,
  mergeIntakeContact,
  normalizeIp,
  parseIntakeOrigins,
  requestOriginAllowed,
  secretsMatch,
  validateIntake,
  type IntakeJob,
  type IntakeReminderPlan,
  type NormalizedIntake,
} from '../../../shared/reminderIntake.ts';

const MAX_BODY_BYTES = 32_768;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type DbError = { code?: string; message?: string } | null;

Deno.serve(async (req: Request) => {
  const origins = parseIntakeOrigins(Deno.env.get('REMINDER_INTAKE_ORIGINS'));
  const origin = req.headers.get('Origin');
  if (origins.invalid) {
    console.error('REMINDER_INTAKE_ORIGINS is invalid');
    return json(req, { error: 'not_configured', message: 'Reminder intake is not configured.' }, 503, []);
  }
  const allowed = origins.origins;

  if (req.method === 'OPTIONS') {
    if (origin && !requestOriginAllowed(origin, allowed)) {
      return json(req, { error: 'origin_not_allowed', message: 'This origin cannot submit reminders.' }, 403, allowed);
    }
    return new Response(null, { status: 204, headers: corsHeaders(origin, allowed) });
  }

  if (req.method !== 'POST') {
    return json(req, { error: 'method_not_allowed', message: 'Use POST.' }, 405, allowed);
  }
  if (origin && !requestOriginAllowed(origin, allowed)) {
    return json(req, { error: 'origin_not_allowed', message: 'This origin cannot submit reminders.' }, 403, allowed);
  }

  const expectedSecret = Deno.env.get('REMINDER_INTAKE_SECRET') ?? '';
  const hostId = (Deno.env.get('REMINDER_INTAKE_HOST_ID') ?? '').trim();
  if (!expectedSecret || !UUID_RE.test(hostId)) {
    console.error('reminder-intake missing REMINDER_INTAKE_SECRET or REMINDER_INTAKE_HOST_ID');
    return json(req, { error: 'not_configured', message: 'Reminder intake is not configured.' }, 503, allowed);
  }
  const providedSecret = req.headers.get('x-intake-secret') ?? '';
  if (!providedSecret || !secretsMatch(providedSecret, expectedSecret)) {
    return json(req, { error: 'unauthorized', message: 'Missing or invalid intake secret.' }, 401, allowed);
  }

  const contentType = req.headers.get('content-type') ?? '';
  if (!contentType.toLowerCase().includes('application/json')) {
    return json(req, { error: 'validation_error', message: 'content-type: must be application/json', fields: { 'content-type': 'must be application/json' } }, 400, allowed);
  }
  const declaredLength = Number(req.headers.get('content-length') ?? '0');
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return json(req, { error: 'payload_too_large', message: 'Payload is too large.' }, 413, allowed);
  }

  let raw = '';
  try {
    raw = await req.text();
  } catch {
    return json(req, { error: 'invalid_json', message: 'Could not read the body.' }, 400, allowed);
  }
  if (raw.length > MAX_BODY_BYTES) {
    return json(req, { error: 'payload_too_large', message: 'Payload is too large.' }, 413, allowed);
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return json(req, { error: 'invalid_json', message: 'Body must be JSON.' }, 400, allowed);
  }

  const validated = validateIntake(body, {
    allowedOrigins: allowed,
    connectionIp: connectionIp(req),
    connectionUserAgent: req.headers.get('user-agent'),
  });
  if (!validated.ok) {
    return json(req, { error: validated.error, message: validated.message, fields: validated.fields }, 400, allowed);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!supabaseUrl || !serviceKey) {
    console.error('reminder-intake missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    return json(req, { error: 'not_configured', message: 'Reminder intake is not configured.' }, 503, allowed);
  }
  const supabase = createClient(supabaseUrl, serviceKey);
  const value = validated.value;

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', hostId)
    .maybeSingle();
  if (profileError) {
    console.error('reminder-intake profile lookup failed:', profileError.message);
    return json(req, { error: 'persist_failed', message: 'Could not save this reminder.' }, 500, allowed);
  }
  if (!profile) {
    console.error('reminder-intake host id does not match a profile');
    return json(req, { error: 'not_configured', message: 'Reminder intake is not configured.' }, 503, allowed);
  }
  if (!await hostPlanIsActive(supabase, hostId)) {
    console.error('reminder-intake host plan is inactive');
    return json(req, { error: 'intake_host_inactive', message: 'Reminder intake is temporarily unavailable.' }, 503, allowed);
  }

  const existing = await loadExisting(supabase, hostId, value.reminders.map((reminder) => reminder.dedupeKey));
  if (!existing.ok) {
    if (existing.missingColumn) {
      return json(req, { error: 'migration_required', message: 'Reminder intake storage is not ready yet.' }, 503, allowed);
    }
    return json(req, { error: 'persist_failed', message: 'Could not save this reminder.' }, 500, allowed);
  }

  const creating = value.reminders.filter((reminder) => !existing.byKey.has(reminder.dedupeKey));
  const rateIp = connectionIp(req) || value.evidenceIp;
  if (creating.length) {
    const recentEmail = await countRecent(supabase, hostId, 'recipient_email', value.email);
    const recentIp = rateIp ? await countRecent(supabase, hostId, 'intake_ip', rateIp) : { ok: true as const, count: 0, missingColumn: false };
    if (!recentEmail.ok || !recentIp.ok) {
      if (recentEmail.missingColumn || recentIp.missingColumn) {
        return json(req, { error: 'migration_required', message: 'Reminder intake storage is not ready yet.' }, 503, allowed);
      }
      return json(req, { error: 'persist_failed', message: 'Could not save this reminder.' }, 500, allowed);
    }
    if (intakeRateLimited({
      recentForEmail: recentEmail.count,
      recentForIp: recentIp.count,
      creating: creating.length,
      ipKnown: Boolean(rateIp),
    })) {
      return json(
        req,
        { error: 'rate_limited', message: 'Too many reminder signups. Try again in an hour.' },
        429,
        allowed,
        { 'Retry-After': '3600' },
      );
    }
  }

  if (value.smsEnabled && creating.length) {
    const consented = await storeSmsConsent(supabase, value);
    if (!consented.ok) {
      if (consented.missingColumn) {
        return json(req, { error: 'migration_required', message: 'Reminder intake storage is not ready yet.' }, 503, allowed);
      }
      return json(req, { error: 'persist_failed', message: 'Could not store SMS consent.' }, 500, allowed);
    }
  }

  const contact = await upsertContact(supabase, hostId, value);
  if (!contact.ok) {
    return json(req, { error: 'persist_failed', message: 'Could not save this contact.' }, 500, allowed);
  }

  const saved = [];
  for (const reminder of value.reminders) {
    const row = await ensureReminder(supabase, hostId, value, reminder, rateIp);
    if (!row.ok) {
      if (row.missingColumn) {
        return json(req, { error: 'migration_required', message: 'Reminder intake storage is not ready yet.' }, 503, allowed);
      }
      return json(req, { error: 'persist_failed', message: 'Could not save this reminder.' }, 500, allowed);
    }
    saved.push(row.reminder);
  }

  return json(req, {
    ok: true,
    duplicate: saved.every((reminder) => reminder.duplicate),
    contact_id: contact.id,
    email_enabled: value.emailEnabled,
    sms_enabled: value.smsEnabled,
    reminders: saved,
  }, 200, allowed);
});

function connectionIp(req: Request): string | null {
  const forwarded = req.headers.get('x-forwarded-for') ?? '';
  const candidates = [
    req.headers.get('cf-connecting-ip'),
    req.headers.get('x-real-ip'),
    ...forwarded.split(','),
  ];
  for (const candidate of candidates) {
    const ip = normalizeIp(candidate);
    if (ip) return ip;
  }
  return null;
}

function corsHeaders(origin: string | null, allowed: string[]): Headers {
  const headers = new Headers({
    Vary: 'Origin',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-intake-secret',
    'Access-Control-Max-Age': '600',
  });
  if (origin && requestOriginAllowed(origin, allowed)) {
    headers.set('Access-Control-Allow-Origin', new URL(origin).origin);
  }
  return headers;
}

function json(
  req: Request,
  body: unknown,
  status: number,
  allowed: string[],
  extra?: Record<string, string>,
): Response {
  const headers = corsHeaders(req.headers.get('Origin'), allowed);
  headers.set('Content-Type', 'application/json');
  if (extra) {
    for (const [key, value] of Object.entries(extra)) headers.set(key, value);
  }
  return new Response(status === 204 ? null : JSON.stringify(body), { status, headers });
}

function missingColumn(error: DbError): boolean {
  if (!error) return false;
  const message = error.message ?? '';
  return error.code === '42703'
    || error.code === 'PGRST204'
    || /schema cache/i.test(message)
    || /recipient_email|recipient_phone|intake_dedupe_key|intake_source|intake_ip|ip_address|consent_version/i.test(message);
}

function isUniqueViolation(error: DbError): boolean {
  return error?.code === '23505' || /duplicate key/i.test(error?.message ?? '');
}

type SupabaseAdmin = ReturnType<typeof createClient>;

async function countRecent(
  supabase: SupabaseAdmin,
  hostId: string,
  column: 'recipient_email' | 'intake_ip',
  value: string,
): Promise<{ ok: true; count: number; missingColumn: false } | { ok: false; missingColumn: boolean }> {
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count, error } = await supabase
    .from('personal_reminders')
    .select('id', { count: 'exact', head: true })
    .eq('host_id', hostId)
    .eq(column, value)
    .gte('created_at', since);
  if (error) {
    console.error('reminder-intake rate-limit count failed:', error.message);
    return { ok: false, missingColumn: missingColumn(error) };
  }
  return { ok: true, count: count ?? 0, missingColumn: false };
}

async function loadExisting(
  supabase: SupabaseAdmin,
  hostId: string,
  keys: string[],
): Promise<{ ok: true; byKey: Map<string, { id: string; status: string }> } | { ok: false; missingColumn: boolean }> {
  const { data, error } = await supabase
    .from('personal_reminders')
    .select('id, status, intake_dedupe_key')
    .eq('host_id', hostId)
    .in('intake_dedupe_key', keys);
  if (error) {
    console.error('reminder-intake dedupe lookup failed:', error.message);
    return { ok: false, missingColumn: missingColumn(error) };
  }
  const byKey = new Map<string, { id: string; status: string }>();
  for (const row of data ?? []) {
    const key = String(row.intake_dedupe_key ?? '');
    if (key) byKey.set(key, { id: String(row.id), status: String(row.status ?? '') });
  }
  return { ok: true, byKey };
}

async function storeSmsConsent(
  supabase: SupabaseAdmin,
  value: NormalizedIntake,
): Promise<{ ok: true } | { ok: false; missingColumn: boolean }> {
  if (!value.smsEnabled || !value.phone || !value.consentText || !value.consentVersion || !value.evidenceIp || !value.userAgent || !value.sourceUrl) {
    console.error('reminder-intake refused SMS without complete consent evidence');
    return { ok: false, missingColumn: false };
  }
  const { error } = await supabase.from('sms_optins').insert({
    name: value.name,
    phone: value.phone,
    consent: true,
    source: `intake:${value.siteHost}`,
    user_agent: value.userAgent,
    disclosure_text: value.consentText,
    page_url: value.sourceUrl,
    ip_address: value.evidenceIp,
    consent_version: value.consentVersion,
    created_at: value.consentAt ?? new Date().toISOString(),
  });
  if (error) {
    console.error('reminder-intake sms consent insert failed:', error.message);
    return { ok: false, missingColumn: missingColumn(error) };
  }
  const { error: optInError } = await supabase.rpc('record_sms_opt_in', {
    p_phone: value.phone,
    p_source: `intake:${value.siteHost}`,
  });
  if (optInError) {
    console.error('reminder-intake record_sms_opt_in failed:', optInError.message);
    return { ok: false, missingColumn: false };
  }
  return { ok: true };
}

async function upsertContact(
  supabase: SupabaseAdmin,
  hostId: string,
  value: NormalizedIntake,
): Promise<{ ok: true; id: string } | { ok: false }> {
  const note = intakeNoteLine(value.siteHost, value.reminders);
  const { data: existingRows, error: selectError } = await supabase
    .from('contacts')
    .select('id, full_name, phone, company, address, notes, source')
    .eq('host_id', hostId)
    .eq('email', value.email)
    .limit(1);
  if (selectError) {
    console.error('reminder-intake contact lookup failed:', selectError.message);
    return { ok: false };
  }
  const existing = existingRows?.[0] ?? null;
  const merged = mergeIntakeContact(existing, {
    email: value.email,
    name: value.name,
    phone: value.phone,
    city: value.city,
    state: value.state,
    trade: value.trade,
    topic: value.topic,
    siteHost: value.siteHost,
    note,
  });
  if (existing?.id) {
    const { error } = await supabase
      .from('contacts')
      .update({ ...merged, updated_at: new Date().toISOString() })
      .eq('id', existing.id);
    if (error) {
      console.error('reminder-intake contact update failed:', error.message);
      return { ok: false };
    }
    return { ok: true, id: String(existing.id) };
  }
  const { data, error } = await supabase
    .from('contacts')
    .insert({ ...merged, host_id: hostId })
    .select('id')
    .single();
  if (error || !data) {
    if (isUniqueViolation(error)) {
      const { data: raced } = await supabase
        .from('contacts')
        .select('id')
        .eq('host_id', hostId)
        .eq('email', value.email)
        .limit(1);
      if (raced?.[0]?.id) {
        await supabase.from('contacts').update({ ...merged, updated_at: new Date().toISOString() }).eq('id', raced[0].id);
        return { ok: true, id: String(raced[0].id) };
      }
    }
    console.error('reminder-intake contact insert failed:', error?.message ?? 'no row');
    return { ok: false };
  }
  return { ok: true, id: String(data.id) };
}

async function ensureReminder(
  supabase: SupabaseAdmin,
  hostId: string,
  value: NormalizedIntake,
  reminder: IntakeReminderPlan,
  rateIp: string | null,
  attempt = 0,
): Promise<{ ok: true; reminder: SavedReminder } | { ok: false; missingColumn: boolean }> {
  const { data: existingRows, error: existingError } = await supabase
    .from('personal_reminders')
    .select('id, status')
    .eq('host_id', hostId)
    .eq('intake_dedupe_key', reminder.dedupeKey)
    .limit(1);
  if (existingError) {
    console.error('reminder-intake reminder lookup failed:', existingError.message);
    return { ok: false, missingColumn: missingColumn(existingError) };
  }
  const existing = existingRows?.[0];
  if (existing?.id) {
    const jobs = await loadJobs(supabase, String(existing.id));
    if (!jobs.ok) return { ok: false, missingColumn: false };
    if (jobs.jobs.length === 0 && existing.status === 'active') {
      const inserted = await insertJobs(supabase, hostId, String(existing.id), reminder.jobs, value);
      if (!inserted.ok) return inserted;
      return {
        ok: true,
        reminder: savedReminder(reminder, String(existing.id), true, inserted.jobs),
      };
    }
    return {
      ok: true,
      reminder: savedReminder(reminder, String(existing.id), true, jobs.jobs),
    };
  }

  const smsPhone = value.smsEnabled ? value.phone : null;
  const { data: created, error: insertError } = await supabase
    .from('personal_reminders')
    .insert({
      host_id: hostId,
      title: reminder.title,
      transcript: buildIntakeTranscript(value),
      location: [value.city, value.state].filter(Boolean).join(', ') || null,
      due_at: reminder.dueAt.toISOString(),
      status: 'active',
      recipient_email: value.email,
      recipient_phone: smsPhone,
      intake_source: value.siteHost,
      intake_dedupe_key: reminder.dedupeKey,
      intake_ip: rateIp,
    })
    .select('id')
    .single();
  if (insertError || !created) {
    if (attempt === 0 && isUniqueViolation(insertError)) {
      return ensureReminder(supabase, hostId, value, reminder, rateIp, 1);
    }
    console.error('reminder-intake reminder insert failed:', insertError?.message ?? 'no row');
    return { ok: false, missingColumn: missingColumn(insertError) };
  }

  const reminderId = String(created.id);
  const inserted = await insertJobs(supabase, hostId, reminderId, reminder.jobs, value);
  if (!inserted.ok) {
    await supabase.from('personal_reminders').delete().eq('id', reminderId);
    return inserted;
  }
  return { ok: true, reminder: savedReminder(reminder, reminderId, false, inserted.jobs) };
}

async function loadJobs(
  supabase: SupabaseAdmin,
  reminderId: string,
): Promise<{ ok: true; jobs: SavedJob[] } | { ok: false }> {
  const { data, error } = await supabase
    .from('personal_reminder_jobs')
    .select('id, channel, fire_at')
    .eq('reminder_id', reminderId);
  if (error) {
    console.error('reminder-intake job lookup failed:', error.message);
    return { ok: false };
  }
  return {
    ok: true,
    jobs: (data ?? []).map((row) => ({
      id: String(row.id),
      channel: String(row.channel),
      fire_at: String(row.fire_at),
    })),
  };
}

async function insertJobs(
  supabase: SupabaseAdmin,
  hostId: string,
  reminderId: string,
  jobs: IntakeJob[],
  value: NormalizedIntake,
): Promise<{ ok: true; jobs: SavedJob[] } | { ok: false; missingColumn: boolean }> {
  const smsPhone = value.smsEnabled ? value.phone : null;
  const rows = jobs
    .filter((job) => job.channel === 'email' || (job.channel === 'sms' && Boolean(smsPhone)))
    .map((job) => ({
      reminder_id: reminderId,
      host_id: hostId,
      fire_at: job.fireAt.toISOString(),
      channel: job.channel,
      kind: 'remind',
    }));
  if (!rows.length || rows.some((row) => row.channel === 'sms' && !smsPhone)) {
    console.error('reminder-intake refused to queue jobs without a delivery channel');
    return { ok: false, missingColumn: false };
  }
  const { data, error } = await supabase
    .from('personal_reminder_jobs')
    .insert(rows)
    .select('id, channel, fire_at');
  if (error) {
    console.error('reminder-intake job insert failed:', error.message);
    return { ok: false, missingColumn: missingColumn(error) };
  }
  return {
    ok: true,
    jobs: (data ?? []).map((row) => ({
      id: String(row.id),
      channel: String(row.channel),
      fire_at: String(row.fire_at),
    })),
  };
}

type SavedJob = { id: string; channel: string; fire_at: string };
type SavedReminder = {
  id: string;
  title: string;
  due_at: string;
  duplicate: boolean;
  jobs: SavedJob[];
};

function savedReminder(
  reminder: IntakeReminderPlan,
  id: string,
  duplicate: boolean,
  jobs: SavedJob[],
): SavedReminder {
  return {
    id,
    title: reminder.title,
    due_at: reminder.dueAt.toISOString(),
    duplicate,
    jobs,
  };
}
