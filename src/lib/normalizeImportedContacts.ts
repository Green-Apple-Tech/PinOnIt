/** Split concatenated Outlook/Gmail contact blobs into real people. */

export type ImportedContactRow = {
  host_id?: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  company: string | null;
  source: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(value: string | null | undefined): boolean {
  const e = (value ?? '').trim().toLowerCase();
  if (!e || /[;,\s]/.test(e)) return false;
  return EMAIL_RE.test(e);
}

/** One person: "Jane Smith" or "Smith, Jane". Not a distribution-list blob. */
export function isValidSingleName(name: string | null | undefined): boolean {
  const n = (name ?? '').trim();
  if (!n || n.includes('@') || /;/.test(n)) return false;
  const commaCount = (n.match(/,/g) || []).length;
  if (commaCount > 1) return false;
  const words = n.replace(/,/g, ' ').split(/\s+/).filter(Boolean);
  if (words.length < 1 || words.length > 5) return false;
  if (commaCount === 1 && words.length >= 4) return false;
  if (words.some((w) => w.length > 40)) return false;
  return /^[\p{L}][\p{L}'’., -]*$/u.test(n);
}

export function looksMalformedContact(fullName: string | null | undefined, email: string | null | undefined): boolean {
  const blob = `${fullName ?? ''} ${email ?? ''}`;
  if (/;/.test(blob)) return true;
  const atCount = (blob.match(/@/g) || []).length;
  return atCount > 1 || ((email ?? '').includes(',') && atCount >= 1);
}

export function splitContactDelimiters(raw: string): string[] {
  const hasSemi = raw.includes(';');
  const emailCount = (raw.match(/@/g) || []).length;
  const chunks = hasSemi
    ? raw.split(';')
    : emailCount > 1
      ? raw.split(/[;,]/)
      : [raw];
  return chunks.flatMap((part) => {
    const p = part.trim();
    if (!p) return [];
    if (p.includes(',') && (p.match(/@/g) || []).length > 1) {
      return p.split(',').map((s) => s.trim()).filter(Boolean);
    }
    return [p];
  });
}

function uniqueEmails(tokens: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const t of tokens) {
    const e = t.trim().toLowerCase();
    if (!isValidEmail(e) || seen.has(e)) continue;
    seen.add(e);
    out.push(e);
  }
  return out;
}

/**
 * Turn one stored/imported row into zero or more valid contacts.
 * Drops concatenated people that cannot be paired 1:1 with an email.
 */
export function expandImportedContact(row: ImportedContactRow): ImportedContactRow[] {
  const nameRaw = (row.full_name ?? '').trim();
  const emailRaw = (row.email ?? '').trim();
  const combined = [nameRaw, emailRaw].filter(Boolean).join(';');
  const tokens = splitContactDelimiters(combined);
  const names = tokens.filter((t) => !t.includes('@') && isValidSingleName(t));
  const emails = uniqueEmails(tokens.filter((t) => t.includes('@')));

  if (!looksMalformedContact(nameRaw, emailRaw)) {
    if (!isValidEmail(emailRaw)) return [];
    const name = nameRaw && isValidSingleName(nameRaw) ? nameRaw : null;
    return [{ ...row, email: emailRaw.toLowerCase(), full_name: name }];
  }

  if (emails.length === 0) return [];

  if (names.length === emails.length) {
    return emails.map((email, i) => ({
      ...row,
      email,
      full_name: names[i],
      phone: i === 0 ? row.phone : null,
    }));
  }

  if (emails.length === 1 && names.length === 1) {
    return [{ ...row, email: emails[0], full_name: names[0] }];
  }

  // Cannot pair safely — keep emails, drop leftover names.
  return emails.map((email, i) => ({
    ...row,
    email,
    full_name: null,
    phone: i === 0 ? row.phone : null,
  }));
}

function filled(value: unknown): boolean {
  return typeof value === 'string' ? value.trim().length > 0 : value != null && value !== '';
}

export function normalizeImportedContacts<T extends ImportedContactRow>(rows: T[]): T[] {
  const expanded = rows.flatMap((row) => expandImportedContact(row) as T[]);
  const map = new Map<string, T>();
  for (const row of expanded) {
    const email = String(row.email ?? '').trim().toLowerCase();
    if (!isValidEmail(email)) continue;
    const next = { ...row, email };
    const prev = map.get(email);
    if (!prev) {
      map.set(email, next);
      continue;
    }
    const rec = next as Record<string, unknown>;
    const old = prev as Record<string, unknown>;
    map.set(email, {
      ...prev,
      ...next,
      full_name: filled(rec.full_name) ? rec.full_name : old.full_name,
      phone: filled(rec.phone) ? rec.phone : old.phone,
      company: filled(rec.company) ? rec.company : old.company,
    } as T);
  }
  return [...map.values()];
}
