/** Header other projects send. The secret itself is the LEAD_ALERT_TOKEN edge secret. */
export const LEAD_ALERT_TOKEN_HEADER = 'x-lead-alert-token';

export type LeadAlertInput = {
  source: string;
  name: string;
  contact: string;
  note: string;
};

function clip(value: unknown, max: number): string {
  if (typeof value !== 'string') return '';
  return value.replace(/\s+/g, ' ').trim().slice(0, max);
}

/** Constant-time compare. A length mismatch is not a match. */
export function secretsMatch(provided: string, expected: string): boolean {
  const a = new TextEncoder().encode(provided);
  const b = new TextEncoder().encode(expected);
  const len = Math.max(a.length, b.length);
  let diff = a.length === b.length ? 0 : 1;
  for (let i = 0; i < len; i++) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diff === 0;
}

export function parseLeadAlertInput(body: unknown):
  | { ok: true; value: LeadAlertInput }
  | { ok: false; error: string } {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, error: 'invalid_body' };
  }
  const record = body as Record<string, unknown>;
  for (const key of ['source', 'name', 'contact', 'note'] as const) {
    if (record[key] != null && typeof record[key] !== 'string') {
      return { ok: false, error: 'invalid_body' };
    }
  }
  const value: LeadAlertInput = {
    source: clip(record.source, 32),
    name: clip(record.name, 40),
    contact: clip(record.contact, 80),
    note: clip(record.note, 80),
  };
  if (!value.name && !value.contact && !value.note) {
    return { ok: false, error: 'missing_lead' };
  }
  return { ok: true, value };
}

/** One short SMS. Example: `New lead (PinOnIt): Ada – ada@example.com – Replacing Calendly`. */
export function formatLeadAlertMessage(input: LeadAlertInput): string {
  const source = clip(input.source, 32) || 'PinOnIt';
  const name = clip(input.name, 40) || 'Unknown';
  const contact = clip(input.contact, 48) || 'no contact';
  const note = clip(input.note, 80);
  const text = note
    ? `New lead (${source}): ${name} – ${contact} – ${note}`
    : `New lead (${source}): ${name} – ${contact}`;
  return text.length <= 160 ? text : `${text.slice(0, 159)}…`;
}

export function normalizeAlertPhone(raw: string | null | undefined): string | null {
  const trimmed = (raw ?? '').trim();
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length < 10 || digits.length > 15) return null;
  return `+${digits}`;
}

/** Fields for the lead-alert call after a PinOnIt bot lead is stored. */
export function leadAlertFromBotLead(input: {
  email?: unknown;
  answers?: unknown;
  source?: unknown;
}): LeadAlertInput {
  const answers = input.answers && typeof input.answers === 'object' && !Array.isArray(input.answers)
    ? input.answers as Record<string, unknown>
    : {};
  const email = clip(input.email, 80);
  const named = clip(answers.name, 40) || clip(answers.full_name, 40);
  const name = named || (email.includes('@') ? email.split('@')[0] : '') || 'Website lead';
  const contact = email || clip(answers.phone, 40) || clip(answers.contact, 60) || 'no contact';
  const note = ['paying', 'pain', 'calendar', 'appointments']
    .map((key) => clip(answers[key], 40))
    .filter(Boolean)
    .join('; ')
    .slice(0, 80);
  return {
    source: 'PinOnIt',
    name,
    contact,
    note: note || clip(input.source, 40) || 'onboarding bot',
  };
}
