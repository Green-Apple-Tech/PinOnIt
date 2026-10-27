import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_INTAKE_ORIGINS,
  intakeRateLimited,
  mergeContactNotes,
  mergeIntakeContact,
  parseIntakeOrigins,
  requestOriginAllowed,
  secretsMatch,
  validateIntake,
} from '../shared/reminderIntake';

const NOW = new Date('2026-06-01T12:00:00.000Z');
const CONSENT = 'I agree to receive recurring SMS reminders from PinOnIt. Reply STOP to cancel.';

function signup(overrides: Record<string, unknown> = {}) {
  return validateIntake({
    email: 'owner@example.com',
    source_site: 'https://businesslicensebycity.com',
    title: 'Miami hair salon license renewal',
    due_dates: ['2026-12-01'],
    city: 'Miami',
    state: 'FL',
    trade: 'Hair Salon',
    ...overrides,
  }, { allowedOrigins: [...DEFAULT_INTAKE_ORIGINS], now: NOW });
}

describe('reminder intake validation', () => {
  it('requires an email and queues email by default', () => {
    const missing = signup({ email: ' ' });
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.fields.email).toBeTruthy();

    const saved = signup();
    expect(saved.ok).toBe(true);
    if (!saved.ok) return;
    expect(saved.value.emailEnabled).toBe(true);
    expect(saved.value.smsEnabled).toBe(false);
    expect(saved.value.phone).toBeNull();
    expect(saved.value.reminders[0].jobs.map((job) => job.channel)).toEqual(['email', 'email']);
    expect(saved.value.reminders[0].dueAt.toISOString()).toBe('2026-12-01T14:00:00.000Z');
  });

  it('treats a date-only due date as 9:00 in the given time zone', () => {
    const summer = signup({ due_dates: ['2026-06-15'], timezone: 'America/New_York' });
    expect(summer.ok).toBe(true);
    if (!summer.ok) return;
    expect(summer.value.reminders[0].dueAt.toISOString()).toBe('2026-06-15T13:00:00.000Z');
    expect(summer.value.reminders[0].jobs.map((job) => job.leadMinutes)).toEqual([-1440, 0]);
  });

  it('does not enable SMS from a string or from a phone alone', () => {
    const asString = signup({ sms_opt_in: 'true', phone: '3055550100' });
    expect(asString.ok).toBe(false);
    if (!asString.ok) expect(asString.fields.sms_opt_in).toMatch(/true or false/);

    const phoneOnly = signup({ phone: '3055550100' });
    expect(phoneOnly.ok).toBe(true);
    if (!phoneOnly.ok) return;
    expect(phoneOnly.value.smsEnabled).toBe(false);
    expect(phoneOnly.value.reminders[0].jobs.every((job) => job.channel === 'email')).toBe(true);
  });

  it('rejects SMS until consent text, version, source URL, IP, and user agent are present', () => {
    const incomplete = signup({
      sms_opt_in: true,
      phone: '3055550100',
      consent_text: CONSENT,
      consent_version: '2026-10-01',
    });
    expect(incomplete.ok).toBe(false);
    if (!incomplete.ok) {
      expect(incomplete.fields.source_url).toMatch(/sms_opt_in/);
      expect(incomplete.fields.client_ip).toMatch(/sms_opt_in/);
      expect(incomplete.fields.user_agent).toMatch(/sms_opt_in/);
    }
  });

  it('queues one SMS an hour before when consent evidence is complete', () => {
    const saved = signup({
      sms_opt_in: true,
      phone: '(305) 555-0100',
      source_url: 'https://www.businesslicensebycity.com/miami/hair-salon',
      consent_text: CONSENT,
      consent_version: '2026-10-01',
      client_ip: '203.0.113.10',
      user_agent: 'Mozilla/5.0',
    });
    expect(saved.ok).toBe(true);
    if (!saved.ok) return;
    expect(saved.value.smsEnabled).toBe(true);
    expect(saved.value.phone).toBe('+13055550100');
    expect(saved.value.evidenceIp).toBe('203.0.113.10');
    expect(saved.value.sourceUrl).toBe('https://www.businesslicensebycity.com/miami/hair-salon');
    const sms = saved.value.reminders[0].jobs.filter((job) => job.channel === 'sms');
    expect(sms).toHaveLength(1);
    expect(sms[0].leadMinutes).toBe(-60);
  });

  it('can send SMS only when email is explicitly off', () => {
    const saved = signup({
      email_opt_in: false,
      sms_opt_in: true,
      phone: '3055550100',
      source_url: 'https://rentalrulesbycity.com/miami',
      source_site: 'rentalrulesbycity.com',
      consent_text: CONSENT,
      consent_version: 'v1',
      client_ip: '2001:db8::1',
      user_agent: 'Mozilla/5.0',
    });
    expect(saved.ok).toBe(true);
    if (!saved.ok) return;
    expect(saved.value.emailEnabled).toBe(false);
    expect(saved.value.smsEnabled).toBe(true);
    expect(saved.value.reminders[0].jobs.map((job) => job.channel)).toEqual(['sms']);
  });

  it('rejects a signup with both channels off, a foreign site, and a past date', () => {
    const neither = signup({ email_opt_in: false, sms_opt_in: false });
    expect(neither.ok).toBe(false);

    const foreign = signup({ source_site: 'https://example.com' });
    expect(foreign.ok).toBe(false);
    if (!foreign.ok) expect(foreign.fields.source_site).toBeTruthy();

    const past = signup({ due_dates: ['2020-01-01'] });
    expect(past.ok).toBe(false);
    if (!past.ok) expect(past.fields.due_dates).toMatch(/past/);

    const impossible = signup({ due_dates: ['2026-02-31'] });
    expect(impossible.ok).toBe(false);
  });

  it('uses the connection IP for SMS when the body omits client_ip', () => {
    const saved = validateIntake({
      email: 'owner@example.com',
      source_site: 'https://businesslicensebycity.com',
      source_url: 'https://businesslicensebycity.com/miami',
      title: 'Renewal',
      due_date: '2026-12-01T09:00:00',
      sms_opt_in: true,
      phone: '3055550100',
      consent_text: CONSENT,
      consent_version: '2026-10-01',
    }, {
      allowedOrigins: [...DEFAULT_INTAKE_ORIGINS],
      now: NOW,
      connectionIp: '198.51.100.20',
      connectionUserAgent: 'SiteServer/1.0',
    });
    expect(saved.ok).toBe(true);
    if (!saved.ok) return;
    expect(saved.value.evidenceIp).toBe('198.51.100.20');
    expect(saved.value.userAgent).toBe('SiteServer/1.0');
    expect(saved.value.reminders[0].dueAt.toISOString()).toBe('2026-12-01T14:00:00.000Z');
  });

  it('skips lead times that are already past and keeps the due-time email', () => {
    const due = new Date(NOW.getTime() + 3 * 60 * 60 * 1000);
    const saved = signup({ due_at: due.toISOString(), due_dates: undefined });
    expect(saved.ok).toBe(true);
    if (!saved.ok) return;
    expect(saved.value.reminders[0].jobs.map((job) => job.leadMinutes)).toEqual([0]);
  });

  it('collapses duplicate due dates', () => {
    const saved = signup({ due_dates: ['2026-12-01', '2026-12-01'] });
    expect(saved.ok).toBe(true);
    if (!saved.ok) return;
    expect(saved.value.reminders).toHaveLength(1);
  });
});

describe('reminder intake request guards', () => {
  it('defaults the origin list and rejects a broken override', () => {
    expect(parseIntakeOrigins(undefined).origins).toEqual([...DEFAULT_INTAKE_ORIGINS]);
    expect(parseIntakeOrigins('https://businesslicensebycity.com, http://rentalrulesbycity.com').invalid).toBe(true);
    expect(requestOriginAllowed(null, [...DEFAULT_INTAKE_ORIGINS])).toBe(true);
    expect(requestOriginAllowed('https://businesslicensebycity.com', [...DEFAULT_INTAKE_ORIGINS])).toBe(true);
    expect(requestOriginAllowed('https://example.com', [...DEFAULT_INTAKE_ORIGINS])).toBe(false);
  });

  it('compares secrets without treating a different length as a match', () => {
    expect(secretsMatch('same-secret', 'same-secret')).toBe(true);
    expect(secretsMatch('same-secret', 'same-secret-x')).toBe(false);
    expect(secretsMatch('same-secret', 'same-secred')).toBe(false);
  });

  it('rate limits new reminders per email and per IP', () => {
    expect(intakeRateLimited({ recentForEmail: 7, recentForIp: 0, creating: 1, ipKnown: true })).toBe(false);
    expect(intakeRateLimited({ recentForEmail: 8, recentForIp: 0, creating: 1, ipKnown: false })).toBe(true);
    expect(intakeRateLimited({ recentForEmail: 0, recentForIp: 24, creating: 1, ipKnown: true })).toBe(true);
    expect(intakeRateLimited({ recentForEmail: 0, recentForIp: 24, creating: 0, ipKnown: true })).toBe(false);
  });

  it('merges contact fields without wiping an imported source or street address', () => {
    const note = 'Reminder intake from businesslicensebycity.com: Renewal (2026-12-01)';
    const merged = mergeIntakeContact({
      full_name: 'Existing Name',
      phone: '+13055550199',
      company: 'Old Co',
      address: '1 Main St',
      notes: 'Met at a job',
      source: 'gmail',
    }, {
      email: 'owner@example.com',
      name: 'Ada Lovelace',
      phone: '+13055550100',
      city: 'Miami',
      state: 'FL',
      trade: 'Hair Salon',
      topic: null,
      siteHost: 'businesslicensebycity.com',
      note,
    });
    expect(merged.source).toBe('gmail');
    expect(merged.address).toBe('1 Main St');
    expect(merged.phone).toBe('+13055550100');
    expect(merged.full_name).toBe('Ada Lovelace');
    expect(merged.company).toBe('Hair Salon');
    expect(merged.notes).toContain('Met at a job');
    expect(mergeContactNotes(merged.notes, note)).toBe(merged.notes);
  });
});

describe('send-reminder intake delivery', () => {
  const send = readFileSync('supabase/functions/send-reminder/index.ts', 'utf8');
  const dispatch = send.slice(send.indexOf('async function dispatchPersonalReminders'));

  it('emails and texts the intake recipient and leaves host voice and WhatsApp alone', () => {
    const jobsQuery = dispatch.slice(
      dispatch.indexOf(".from('personal_reminder_jobs')"),
      dispatch.indexOf('loadIntakeRecipients('),
    );
    expect(jobsQuery).not.toMatch(/recipient_email/);
    expect(dispatch).toMatch(/const to = intakeEmail \|\| hostEmail/);
    expect(dispatch).toMatch(/const to = intakePhone \|\| hostPhone/);
    expect(dispatch).toMatch(/deliveredToIntake/);

    const voice = dispatch.slice(dispatch.indexOf("job.channel === 'voice'"), dispatch.indexOf('sendTwilioVoice'));
    expect(voice).toMatch(/const to = hostPhone/);
    expect(voice).not.toMatch(/intakePhone/);

    const whatsapp = dispatch.slice(dispatch.indexOf("job.channel === 'whatsapp'"), dispatch.indexOf("job.channel === 'voice'"));
    expect(whatsapp).toMatch(/const to = hostWhatsapp/);
    expect(whatsapp).not.toMatch(/intakePhone/);
  });
});
