import type { SmbDocumentType } from './types';
import notices from './legalStateNotices.json';

const STATE_NAMES: Record<string, string> = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California',
  CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', FL: 'Florida', GA: 'Georgia',
  HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa',
  KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland',
  MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri',
  MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey',
  NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio',
  OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina',
  SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont',
  VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
  DC: 'the District of Columbia',
};

export const STATE_NOTICE_DOCUMENT_TYPES = ['waiver', 'parental_consent_waiver'] as const;

type NoticeMap = Record<string, Record<string, string>>;

const NOTICE_CONFIG = notices as NoticeMap;

/** Host-side only. Never infer state from IP or timezone — pass the stored business-address state. */
export function hostLegalStateNotice(
  documentType: SmbDocumentType,
  businessRegion?: string | null,
): string | null {
  if (!STATE_NOTICE_DOCUMENT_TYPES.includes(documentType as (typeof STATE_NOTICE_DOCUMENT_TYPES)[number])) {
    return null;
  }
  const byType = NOTICE_CONFIG[documentType];
  if (!byType) return null;
  const code = (businessRegion || '').trim().toUpperCase();
  if (code && byType[code]) return byType[code];
  return byType.default || null;
}

export function usStateName(code?: string | null): string | null {
  const key = (code || '').trim().toUpperCase();
  return key ? STATE_NAMES[key] ?? null : null;
}
