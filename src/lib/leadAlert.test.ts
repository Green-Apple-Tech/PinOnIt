import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  LEAD_ALERT_TOKEN_HEADER,
  formatLeadAlertMessage,
  leadAlertFromBotLead,
  normalizeAlertPhone,
  parseLeadAlertInput,
  secretsMatch,
} from '../shared/leadAlert';

function read(rel: string) {
  return readFileSync(new URL(rel, import.meta.url), 'utf8');
}

describe('lead alert messages', () => {
  it('keeps the text short', () => {
    expect(formatLeadAlertMessage({
      source: 'PinOnIt',
      name: 'Ada Lovelace',
      contact: 'ada@example.com',
      note: 'Replacing Calendly and DocuSign',
    })).toBe('New lead (PinOnIt): Ada Lovelace – ada@example.com – Replacing Calendly and DocuSign');
  });

  it('fills gaps and drops a blank note', () => {
    expect(formatLeadAlertMessage({ source: '', name: '', contact: '', note: 'asked for a demo' }))
      .toBe('New lead (PinOnIt): Unknown – no contact – asked for a demo');
    expect(formatLeadAlertMessage({ source: 'POM AI', name: 'Sam', contact: '3055550100', note: '' }))
      .toBe('New lead (POM AI): Sam – 3055550100');
  });

  it('truncates a long note to one SMS', () => {
    const message = formatLeadAlertMessage({
      source: 'cold-email',
      name: 'A very long lead name that should be clipped',
      contact: 'person@example.com',
      note: 'x'.repeat(200),
    });
    expect(message.length).toBeLessThanOrEqual(160);
    expect(message.startsWith('New lead (cold-email):')).toBe(true);
  });

  it('rejects a body that is not a lead', () => {
    expect(parseLeadAlertInput(null).ok).toBe(false);
    expect(parseLeadAlertInput({ source: 1 }).ok).toBe(false);
    expect(parseLeadAlertInput({ source: 'PinOnIt' }).ok).toBe(false);
    const parsed = parseLeadAlertInput({
      source: 'cold-email',
      name: 'Ada',
      contact: 'ada@example.com',
      note: 'Replied yes',
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(formatLeadAlertMessage(parsed.value)).toBe(
      'New lead (cold-email): Ada – ada@example.com – Replied yes',
    );
  });

  it('compares the shared secret without treating a different length as a match', () => {
    expect(LEAD_ALERT_TOKEN_HEADER).toBe('x-lead-alert-token');
    expect(secretsMatch('same-secret', 'same-secret')).toBe(true);
    expect(secretsMatch('same-secret', 'same-secret-x')).toBe(false);
    expect(secretsMatch('same-secret', 'same-secred')).toBe(false);
    expect(secretsMatch('', 'same-secret')).toBe(false);
  });

  it('normalizes the alert phone and summarizes a bot lead', () => {
    expect(normalizeAlertPhone('+1 (305) 555-0100')).toBe('+13055550100');
    expect(normalizeAlertPhone('555')).toBeNull();
    expect(leadAlertFromBotLead({
      email: 'ada@example.com',
      source: 'onboarding_bot',
      answers: {
        paying: 'Yes, Calendly — paying too much',
        pain: 'Too expensive',
        calendar: 'Google Calendar',
      },
    })).toEqual({
      source: 'PinOnIt',
      name: 'ada',
      contact: 'ada@example.com',
      note: 'Yes, Calendly — paying too much; Too expensive; Google Calendar',
    });
  });

  it('wires the edge function and save-bot-lead to the shared secret', () => {
    const alert = read('../../supabase/functions/lead-alert/index.ts');
    const save = read('../../supabase/functions/save-bot-lead/index.ts');
    const gate = read('../../supabase/functions/_shared/sms-send-gate.ts');
    const readme = read('../../README.md');

    expect(alert).toContain('LEAD_ALERT_TOKEN');
    expect(alert).toContain('LEAD_ALERT_PHONE');
    expect(alert).toContain('sendTwilioSmsFromNumber');
    expect(alert).toContain('LEAD_ALERT_TOKEN_HEADER');
    expect(save).toContain('/functions/v1/lead-alert');
    expect(save).toContain('leadAlertFromBotLead');
    expect(save).toContain('LEAD_ALERT_TOKEN_HEADER');
    expect(gate).toContain("Deno.env.get('TWILIO_PHONE_NUMBER')");
    expect(readme).toContain('LEAD_ALERT_TOKEN');
    expect(readme).toContain('LEAD_ALERT_PHONE');
    expect(readme).toContain('x-lead-alert-token');
    expect(readme).toContain('/signup?promo=FREE60');
    expect(readme).toContain('/signup?promo=SWITCH');
  });
});
