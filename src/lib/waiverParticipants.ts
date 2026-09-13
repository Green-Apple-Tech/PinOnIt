export type WaiverParticipant = {
  id: string;
  fullName: string;
  dateOfBirth: string;
};

export const PARENTAL_CONSENT_STATEMENT =
  'I am the parent or legal guardian of each child listed on this form, and I am authorized to sign this waiver for each of them.';

export const WAIVER_RETENTION_OPTIONS = [
  { value: 'keep', label: 'Keep completed waivers' },
  { value: '365', label: 'Delete after 1 year' },
  { value: '1095', label: 'Delete after 3 years' },
  { value: '2555', label: 'Delete after 7 years' },
] as const;

export type WaiverRetentionValue = (typeof WAIVER_RETENTION_OPTIONS)[number]['value'];

export function newWaiverParticipant(): WaiverParticipant {
  const id =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `p-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return { id, fullName: '', dateOfBirth: '' };
}

export function emptyWaiverParticipants(count = 1): WaiverParticipant[] {
  return Array.from({ length: Math.max(1, count) }, () => newWaiverParticipant());
}

export function validWaiverParticipants(rows: WaiverParticipant[]) {
  return rows.filter((row) => row.fullName.trim() && /^\d{4}-\d{2}-\d{2}$/.test(row.dateOfBirth));
}

/** Display-only age from DOB. Never persist the result. */
export function ageFromDob(isoDate: string, now = new Date()): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return null;
  const [y, m, d] = isoDate.split('-').map(Number);
  const born = new Date(y, m - 1, d);
  if (Number.isNaN(born.getTime())) return null;
  let age = now.getFullYear() - born.getFullYear();
  const hadBirthday =
    now.getMonth() > born.getMonth() ||
    (now.getMonth() === born.getMonth() && now.getDate() >= born.getDate());
  if (!hadBirthday) age -= 1;
  return age >= 0 && age < 150 ? age : null;
}

export function isWaiverFamily(type: string) {
  return type === 'waiver' || type === 'parental_consent_waiver';
}

export function isParentalConsentWaiver(type: string) {
  return type === 'parental_consent_waiver';
}
