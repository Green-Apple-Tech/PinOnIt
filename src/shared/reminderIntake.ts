import { normalizePhoneE164 } from './phone.ts';

/** Browser origins allowed to call reminder-intake when REMINDER_INTAKE_ORIGINS is unset. */
export const DEFAULT_INTAKE_ORIGINS = [
  'https://businesslicensebycity.com',
  'https://www.businesslicensebycity.com',
  'https://rentalrulesbycity.com',
  'https://www.rentalrulesbycity.com',
] as const;

export const INTAKE_EMAIL_HOURLY_LIMIT = 8;
export const INTAKE_IP_HOURLY_LIMIT = 24;
export const MAX_INTAKE_REMINDERS = 8;

const PAST_GRACE_MS = 2 * 60 * 1000;
const MAX_FUTURE_MS = 5 * 366 * 24 * 60 * 60 * 1000;
const CONSENT_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const CONSENT_FUTURE_SKEW_MS = 5 * 60 * 1000;
const EMAIL_LEAD_MINUTES = [-1440, 0];
const SMS_LEAD_MINUTES = [-60];

const PRESERVE_CONTACT_SOURCES = new Set(['gmail', 'outlook']);

export type IntakeChannel = 'email' | 'sms';

export type IntakeJob = {
  channel: IntakeChannel;
  fireAt: Date;
  leadMinutes: number;
};

export type IntakeReminderPlan = {
  title: string;
  dueAt: Date;
  dedupeKey: string;
  jobs: IntakeJob[];
};

export type NormalizedIntake = {
  email: string;
  name: string | null;
  phone: string | null;
  siteHost: string;
  sourceUrl: string | null;
  city: string | null;
  state: string | null;
  trade: string | null;
  topic: string | null;
  timezone: string;
  emailEnabled: boolean;
  smsEnabled: boolean;
  consentText: string | null;
  consentVersion: string | null;
  consentAt: string | null;
  /** IP stored with TCPA evidence. Body client_ip wins over the connection IP. */
  evidenceIp: string | null;
  userAgent: string | null;
  reminders: IntakeReminderPlan[];
};

export type IntakeValidation =
  | { ok: true; value: NormalizedIntake }
  | { ok: false; error: 'validation_error'; message: string; fields: Record<string, string> };

export function secretsMatch(provided: string, expected: string): boolean {
  const a = new TextEncoder().encode(provided);
  const b = new TextEncoder().encode(expected);
  const len = Math.max(a.length, b.length);
  let diff = a.length === b.length ? 0 : 1;
  for (let i = 0; i < len; i++) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diff === 0;
}

export function parseIntakeOrigins(raw: string | undefined | null): { origins: string[]; invalid: boolean } {
  if (raw == null || raw.trim() === '') {
    return { origins: [...DEFAULT_INTAKE_ORIGINS], invalid: false };
  }
  const origins: string[] = [];
  let invalid = false;
  for (const part of raw.split(',')) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    try {
      const url = new URL(trimmed);
      if (url.protocol !== 'https:' || url.username || url.password || url.origin === 'null') {
        invalid = true;
        continue;
      }
      origins.push(url.origin);
    } catch {
      invalid = true;
    }
  }
  if (invalid || origins.length === 0) return { origins: [], invalid: true };
  return { origins: [...new Set(origins)], invalid: false };
}

export function requestOriginAllowed(originHeader: string | null, allowed: string[]): boolean {
  if (!originHeader) return true;
  try {
    return allowed.includes(new URL(originHeader).origin);
  } catch {
    return false;
  }
}

export function canonicalSiteHost(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed || trimmed.length > 200) return null;
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(withScheme);
    if (url.protocol !== 'https:' || url.username || url.password) return null;
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    if (!host || !host.includes('.') || host === 'localhost') return null;
    return host;
  } catch {
    return null;
  }
}

export function allowedSiteHosts(origins: string[]): Set<string> {
  const hosts = new Set<string>();
  for (const origin of origins) {
    const host = canonicalSiteHost(origin);
    if (host) hosts.add(host);
  }
  return hosts;
}

export function normalizeIp(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const value = raw.trim();
  if (!value || value.length > 64) return null;
  if (isIpv4(value) || isIpv6(value)) return value.toLowerCase();
  return null;
}

export function intakeDedupeKey(parts: {
  siteHost: string;
  email: string;
  title: string;
  dueAtIso: string;
}): string {
  return [parts.siteHost, parts.email, parts.title.trim().toLowerCase(), parts.dueAtIso].join('|').slice(0, 500);
}

export function planIntakeJobs(
  dueAt: Date,
  opts: { email: boolean; sms: boolean; now?: Date },
): IntakeJob[] {
  const nowMs = (opts.now ?? new Date()).getTime();
  const jobs: IntakeJob[] = [];
  const seen = new Set<string>();
  const add = (channel: IntakeChannel, leadMinutes: number) => {
    const fireAt = new Date(dueAt.getTime() + leadMinutes * 60 * 1000);
    if (fireAt.getTime() < nowMs - PAST_GRACE_MS) return;
    const key = `${channel}|${fireAt.toISOString()}`;
    if (seen.has(key)) return;
    seen.add(key);
    jobs.push({ channel, fireAt, leadMinutes });
  };
  if (opts.email) for (const lead of EMAIL_LEAD_MINUTES) add('email', lead);
  if (opts.sms) for (const lead of SMS_LEAD_MINUTES) add('sms', lead);
  jobs.sort((a, b) => a.fireAt.getTime() - b.fireAt.getTime() || a.channel.localeCompare(b.channel));
  return jobs;
}

export function intakeRateLimited(opts: {
  recentForEmail: number;
  recentForIp: number;
  creating: number;
  ipKnown: boolean;
}): boolean {
  if (opts.creating <= 0) return false;
  if (opts.recentForEmail + opts.creating > INTAKE_EMAIL_HOURLY_LIMIT) return true;
  if (opts.ipKnown && opts.recentForIp + opts.creating > INTAKE_IP_HOURLY_LIMIT) return true;
  return false;
}

export function buildIntakeTranscript(opts: {
  city: string | null;
  state: string | null;
  trade: string | null;
  topic: string | null;
  sourceUrl: string | null;
  siteHost: string;
  timezone: string;
}): string {
  const place = [opts.city, opts.state].filter(Boolean).join(', ');
  const lines = [
    place,
    opts.trade,
    opts.topic && opts.topic !== opts.trade ? opts.topic : '',
    opts.sourceUrl,
    `Source: ${opts.siteHost}`,
    `Time zone: ${opts.timezone}`,
  ].filter((line): line is string => Boolean(line && line.trim()));
  return lines.join('\n').slice(0, 2000);
}

export function intakeNoteLine(siteHost: string, reminders: { title: string; dueAt: Date }[]): string {
  const bits = reminders.map((reminder) => `${reminder.title} (${reminder.dueAt.toISOString().slice(0, 10)})`);
  return `Reminder intake from ${siteHost}: ${bits.join('; ')}`.slice(0, 500);
}

export function mergeContactNotes(existing: string | null | undefined, line: string): string {
  const next = line.trim();
  const prev = (existing || '').trim();
  if (!next) return prev.slice(0, 4000);
  if (prev.includes(next)) return prev.slice(0, 4000);
  return (prev ? `${prev}\n${next}` : next).slice(0, 4000);
}

export function mergeIntakeContact(
  existing: {
    full_name?: string | null;
    phone?: string | null;
    company?: string | null;
    address?: string | null;
    notes?: string | null;
    source?: string | null;
  } | null,
  incoming: {
    email: string;
    name: string | null;
    phone: string | null;
    city: string | null;
    state: string | null;
    trade: string | null;
    topic: string | null;
    siteHost: string;
    note: string;
  },
): {
  email: string;
  full_name: string | null;
  phone: string | null;
  company: string | null;
  address: string | null;
  notes: string;
  source: string;
} {
  const sourceIncoming = `intake:${incoming.siteHost}`;
  const place = [incoming.city, incoming.state].filter(Boolean).join(', ') || null;
  const companyIncoming = incoming.trade || incoming.topic || null;
  if (!existing) {
    return {
      email: incoming.email,
      full_name: incoming.name,
      phone: incoming.phone,
      company: companyIncoming,
      address: place,
      notes: mergeContactNotes(null, incoming.note),
      source: sourceIncoming,
    };
  }
  const source = existing.source && PRESERVE_CONTACT_SOURCES.has(existing.source)
    ? existing.source
    : sourceIncoming;
  const address = existing.address?.trim() ? existing.address : (place || existing.address || null);
  return {
    email: incoming.email,
    full_name: incoming.name || existing.full_name || null,
    phone: incoming.phone || existing.phone || null,
    company: companyIncoming || existing.company || null,
    address,
    notes: mergeContactNotes(existing.notes, incoming.note),
    source,
  };
}

export function validateIntake(
  body: unknown,
  opts: {
    allowedOrigins: string[];
    now?: Date;
    connectionIp?: string | null;
    connectionUserAgent?: string | null;
  },
): IntakeValidation {
  const fields: Record<string, string> = {};
  const record = asRecord(body);
  if (!record) {
    return fail({ body: 'must be a JSON object' });
  }

  const now = opts.now ?? new Date();
  const allowedHosts = allowedSiteHosts(opts.allowedOrigins);
  const email = typeof record.email === 'string' ? record.email.trim().toLowerCase() : '';
  if (!email) fields.email = 'required';
  else if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fields.email = 'must be an email address';

  const name = readText(record, ['name', 'full_name'], 120);
  const siteRaw = readText(record, ['source_site', 'source', 'site'], 200);
  const siteHost = siteRaw ? canonicalSiteHost(siteRaw) : null;
  if (!siteRaw) fields.source_site = 'required';
  else if (!siteHost || !allowedHosts.has(siteHost)) fields.source_site = 'must be one of the allowed sites';

  const city = readText(record, ['city'], 80);
  const stateRaw = readText(record, ['state'], 40);
  const state = stateRaw && /^[A-Za-z]{2}$/.test(stateRaw) ? stateRaw.toUpperCase() : stateRaw;
  const trade = readText(record, ['trade'], 120);
  const topic = readText(record, ['topic'], 120);

  const timezoneRaw = readText(record, ['timezone', 'time_zone'], 80);
  const timezone = timezoneRaw || 'America/New_York';
  if (!timezoneOk(timezone)) fields.timezone = 'must be an IANA time zone';

  const emailEnabled = readBool(record, 'email_opt_in', true, fields);
  const smsRequested = readBool(record, 'sms_opt_in', false, fields);

  let phone: string | null = null;
  if (typeof record.phone === 'string' && record.phone.trim()) {
    phone = validE164(record.phone);
    if (!phone) fields.phone = 'must be a phone number';
  } else if (record.phone != null && record.phone !== '') {
    fields.phone = 'must be a phone number';
  }

  const evidenceIp = readEvidenceIp(record, opts.connectionIp ?? null, fields);
  const userAgent = readUserAgent(record, opts.connectionUserAgent ?? null, fields);

  let sourceUrl: string | null = null;
  const sourceUrlRaw = readText(record, ['source_url', 'page_url'], 500);
  if (sourceUrlRaw) {
    if (!siteHost) sourceUrl = null;
    else {
      sourceUrl = httpsUrlOnSite(sourceUrlRaw, siteHost);
      if (!sourceUrl) fields.source_url = 'must be an https URL on source_site';
    }
  }

  let consentText: string | null = null;
  let consentVersion: string | null = null;
  let consentAt: string | null = null;
  if (smsRequested && !fields.sms_opt_in) {
    if (!phone) fields.phone = fields.phone || 'required when sms_opt_in is true';
    consentText = typeof record.consent_text === 'string' ? record.consent_text.trim() : '';
    if (consentText.length < 20) fields.consent_text = 'required when sms_opt_in is true';
    else if (consentText.length > 2000) fields.consent_text = 'must be 2000 characters or fewer';
    consentVersion = typeof record.consent_version === 'string' ? record.consent_version.trim() : '';
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,39}$/.test(consentVersion)) {
      fields.consent_version = 'required when sms_opt_in is true';
    }
    if (!sourceUrl && !fields.source_url) fields.source_url = 'required when sms_opt_in is true';
    if (!evidenceIp && !fields.client_ip) fields.client_ip = 'required when sms_opt_in is true';
    if (!userAgent && !fields.user_agent) fields.user_agent = 'required when sms_opt_in is true';
    consentAt = readConsentAt(record.consent_at, now, fields);
  }

  const smsEnabled = smsRequested && !fields.sms_opt_in && !fields.phone && !fields.consent_text
    && !fields.consent_version && !fields.source_url && !fields.client_ip && !fields.user_agent
    && !fields.consent_at;
  if (!emailEnabled && !smsRequested && !fields.email_opt_in) {
    fields.email_opt_in = 'leave email on, or set sms_opt_in with consent';
  }

  const rawReminders = readRawReminders(record, fields);
  const reminders: IntakeReminderPlan[] = [];
  if (rawReminders && siteHost && email && !fields.timezone) {
    const seen = new Set<string>();
    for (const raw of rawReminders) {
      const dueAt = parseDueAt(raw.dueRaw, timezone);
      if (!dueAt) {
        fields.due_dates = `${raw.dueRaw} is not a valid date`;
        break;
      }
      if (dueAt.getTime() < now.getTime() - PAST_GRACE_MS) {
        fields.due_dates = `${raw.dueRaw} is in the past`;
        break;
      }
      if (dueAt.getTime() - now.getTime() > MAX_FUTURE_MS) {
        fields.due_dates = `${raw.dueRaw} is more than 5 years away`;
        break;
      }
      const jobs = planIntakeJobs(dueAt, { email: emailEnabled, sms: smsEnabled, now });
      if (!jobs.length) {
        fields.due_dates = `${raw.dueRaw} is too soon to schedule`;
        break;
      }
      const dedupeKey = intakeDedupeKey({
        siteHost,
        email,
        title: raw.title,
        dueAtIso: dueAt.toISOString(),
      });
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);
      reminders.push({ title: raw.title, dueAt, dedupeKey, jobs });
    }
  }

  if (Object.keys(fields).length) return fail(fields);
  if (!siteHost || !reminders.length) return fail({ due_dates: 'required' });

  return {
    ok: true,
    value: {
      email,
      name: name || null,
      phone,
      siteHost,
      sourceUrl,
      city: city || null,
      state: state || null,
      trade: trade || null,
      topic: topic || null,
      timezone,
      emailEnabled,
      smsEnabled,
      consentText: smsEnabled ? consentText : null,
      consentVersion: smsEnabled ? consentVersion : null,
      consentAt: smsEnabled ? consentAt : null,
      evidenceIp,
      userAgent: userAgent || null,
      reminders,
    },
  };
}

function fail(fields: Record<string, string>): IntakeValidation {
  const first = Object.entries(fields)[0];
  return {
    ok: false,
    error: 'validation_error',
    message: first ? `${first[0]}: ${first[1]}` : 'Invalid reminder signup.',
    fields,
  };
}

function asRecord(body: unknown): Record<string, unknown> | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  return body as Record<string, unknown>;
}

function readText(record: Record<string, unknown>, keys: string[], max: number): string {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return cleanText(value, max);
  }
  return '';
}

function cleanText(raw: string, max: number): string {
  let text = '';
  for (const char of raw) {
    const code = char.charCodeAt(0);
    text += code < 32 || code === 127 ? ' ' : char;
  }
  return text.replace(/\s+/g, ' ').trim().slice(0, max);
}

function readBool(
  record: Record<string, unknown>,
  key: string,
  fallback: boolean,
  fields: Record<string, string>,
): boolean {
  if (!(key in record) || record[key] == null) return fallback;
  if (typeof record[key] === 'boolean') return record[key] as boolean;
  fields[key] = 'must be true or false';
  return fallback;
}

function readEvidenceIp(
  record: Record<string, unknown>,
  connectionIp: string | null,
  fields: Record<string, string>,
): string | null {
  const hasBodyIp = 'client_ip' in record || 'ip' in record;
  if (hasBodyIp) {
    const raw = record.client_ip ?? record.ip;
    if (typeof raw === 'string' && raw.trim()) {
      const parsed = normalizeIp(raw);
      if (!parsed) {
        fields.client_ip = 'must be an IP address';
        return null;
      }
      return parsed;
    }
    if (raw != null && raw !== '') {
      fields.client_ip = 'must be an IP address';
      return null;
    }
  }
  return normalizeIp(connectionIp);
}

function readUserAgent(
  record: Record<string, unknown>,
  connectionUserAgent: string | null,
  fields: Record<string, string>,
): string | null {
  if ('user_agent' in record && record.user_agent != null && record.user_agent !== '') {
    if (typeof record.user_agent !== 'string') {
      fields.user_agent = 'must be a string';
      return null;
    }
    const agent = record.user_agent.trim();
    if (!agent || agent.length > 500) {
      fields.user_agent = 'must be 500 characters or fewer';
      return null;
    }
    return agent;
  }
  const header = (connectionUserAgent || '').trim();
  return header ? header.slice(0, 500) : null;
}

function readConsentAt(raw: unknown, now: Date, fields: Record<string, string>): string | null {
  if (raw == null || raw === '') return null;
  if (typeof raw !== 'string') {
    fields.consent_at = 'must be an ISO timestamp';
    return null;
  }
  const ms = Date.parse(raw);
  if (Number.isNaN(ms)) {
    fields.consent_at = 'must be an ISO timestamp';
    return null;
  }
  if (ms < now.getTime() - CONSENT_MAX_AGE_MS || ms > now.getTime() + CONSENT_FUTURE_SKEW_MS) {
    fields.consent_at = 'must be within the last day';
    return null;
  }
  return new Date(ms).toISOString();
}

function readRawReminders(
  record: Record<string, unknown>,
  fields: Record<string, string>,
): { title: string; dueRaw: string }[] | null {
  const topTitle = readText(record, ['title'], 180);
  if (Array.isArray(record.reminders)) {
    if (record.reminders.length === 0) {
      fields.reminders = 'add at least one reminder';
      return null;
    }
    if (record.reminders.length > MAX_INTAKE_REMINDERS) {
      fields.reminders = `at most ${MAX_INTAKE_REMINDERS} reminders`;
      return null;
    }
    const out: { title: string; dueRaw: string }[] = [];
    for (let i = 0; i < record.reminders.length; i++) {
      const item = record.reminders[i];
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        fields.reminders = 'each reminder must be an object';
        return null;
      }
      const row = item as Record<string, unknown>;
      const title = readText(row, ['title'], 180) || topTitle;
      const dueRaw = readText(row, ['due_at', 'due_date', 'due'], 80);
      if (!title) fields[`reminders[${i}].title`] = 'required';
      if (!dueRaw) fields[`reminders[${i}].due_at`] = 'required';
      else if (title) out.push({ title, dueRaw });
    }
    if (Object.keys(fields).some((key) => key.startsWith('reminders'))) return null;
    return out;
  }
  if (record.reminders != null) {
    fields.reminders = 'must be an array';
    return null;
  }

  const dueList: string[] = [];
  if (Array.isArray(record.due_dates)) {
    if (record.due_dates.length > MAX_INTAKE_REMINDERS) {
      fields.due_dates = `at most ${MAX_INTAKE_REMINDERS} dates`;
      return null;
    }
    for (const item of record.due_dates) {
      if (typeof item !== 'string' || !item.trim()) {
        fields.due_dates = 'each due date must be a date string';
        return null;
      }
      dueList.push(item.trim());
    }
  } else if (typeof record.due_dates === 'string' && record.due_dates.trim()) {
    dueList.push(record.due_dates.trim());
  } else {
    const one = readText(record, ['due_at', 'due_date'], 80);
    if (one) dueList.push(one);
  }
  if (!dueList.length) {
    fields.due_dates = 'required';
    return null;
  }
  if (!topTitle) {
    fields.title = 'required';
    return null;
  }
  return dueList.map((dueRaw) => ({ title: topTitle, dueRaw }));
}

export function parseDueAt(raw: string, timeZone: string): Date | null {
  const value = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return zonedLocalToUtc(value, '09:00', timeZone);
  const local = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(?::\d{2})?$/.exec(value);
  if (local) return zonedLocalToUtc(local[1], local[2], timeZone);
  if (/^\d{4}-\d{2}-\d{2}T/.test(value) && /(Z|[+-]\d{2}:\d{2})$/i.test(value)) {
    const ms = Date.parse(value);
    return Number.isNaN(ms) ? null : new Date(ms);
  }
  return null;
}

function timezoneOk(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone }).format(0);
    return true;
  } catch {
    return false;
  }
}

function zonedLocalToUtc(date: string, time: string, timeZone: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const clock = /^(\d{2}):(\d{2})$/.exec(time);
  if (!match || !clock || !timezoneOk(timeZone)) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(clock[1]);
  const minute = Number(clock[2]);
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) return null;
  const guess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
  const offset1 = zoneOffsetMs(guess, timeZone);
  if (offset1 == null) return null;
  let utc = new Date(guess.getTime() - offset1);
  const offset2 = zoneOffsetMs(utc, timeZone);
  if (offset2 == null) return null;
  utc = new Date(guess.getTime() - offset2);
  const parts = zoneParts(utc, timeZone);
  if (!parts) return null;
  if (parts.year !== year || parts.month !== month || parts.day !== day || parts.hour !== hour || parts.minute !== minute) {
    return null;
  }
  return utc;
}

function zoneOffsetMs(instant: Date, timeZone: string): number | null {
  const parts = zoneParts(instant, timeZone);
  if (!parts) return null;
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return asUtc - instant.getTime();
}

function zoneParts(instant: Date, timeZone: string): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
} | null {
  try {
    const formatted = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).formatToParts(instant);
    const map: Record<string, string> = {};
    for (const part of formatted) map[part.type] = part.value;
    let hour = Number(map.hour);
    if (hour === 24) hour = 0;
    return {
      year: Number(map.year),
      month: Number(map.month),
      day: Number(map.day),
      hour,
      minute: Number(map.minute),
      second: Number(map.second),
    };
  } catch {
    return null;
  }
}

function httpsUrlOnSite(raw: string, siteHost: string): string | null {
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' || url.username || url.password) return null;
    if (canonicalSiteHost(url.origin) !== siteHost) return null;
    return `${url.origin}${url.pathname}${url.search}`.slice(0, 500);
  } catch {
    return null;
  }
}

function validE164(raw: string): string | null {
  const phone = normalizePhoneE164(raw);
  const digits = phone.replace(/\D/g, '');
  if (!phone.startsWith('+') || digits.length < 10 || digits.length > 15) return null;
  return phone;
}

function isIpv4(value: string): boolean {
  const parts = value.split('.');
  if (parts.length !== 4) return false;
  return parts.every((part) => {
    if (!/^\d{1,3}$/.test(part)) return false;
    const octet = Number(part);
    return octet <= 255 && String(octet) === part;
  });
}

function isIpv6(value: string): boolean {
  if (!value.includes(':') || !/^[0-9a-f:]+$/i.test(value)) return false;
  const halves = value.split('::');
  if (halves.length > 2) return false;
  const groups = halves.join(':').split(':').filter((group) => group.length > 0);
  if (groups.some((group) => group.length > 4 || !/^[0-9a-f]+$/i.test(group))) return false;
  return halves.length === 2 ? groups.length < 8 : groups.length === 8;
}
