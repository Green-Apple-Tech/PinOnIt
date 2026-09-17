import { CONTRACT_STARTER_TEXT, NDA_STARTER_TEXT, WAIVER_STARTER_TEXT } from './documents';

export const BOOKING_AGREEMENT_TYPES = [
  { id: 'waiver', label: 'Waiver' },
  { id: 'nda', label: 'NDA' },
  { id: 'contract', label: 'Contract' },
  { id: 'approval', label: 'Approval' },
  { id: 'other', label: 'Other' },
] as const;

export type BookingAgreementType = (typeof BOOKING_AGREEMENT_TYPES)[number]['id'];

/** Short NDA used on existing bookings before hosts could pick a type. */
export const LEGACY_BOOKING_NDA_TEXT =
  'The parties agree to keep confidential all information shared during this session. Neither party shall disclose any proprietary, confidential, or sensitive information shared during or after this consultation to any third party without prior written consent.';

export const APPROVAL_STARTER_TEXT = `APPROVAL

I approve this booking and the work or visit described. I confirm the details are correct and I want to proceed.

This approval is given when I check the box below.`;

export function isBookingAgreementType(value: unknown): value is BookingAgreementType {
  return typeof value === 'string' && BOOKING_AGREEMENT_TYPES.some((t) => t.id === value);
}

export function bookingAgreementLabel(type: string | null | undefined): string {
  const found = BOOKING_AGREEMENT_TYPES.find((t) => t.id === type);
  if (found) return found.label;
  return 'agreement';
}

export function defaultBookingAgreementText(type: BookingAgreementType): string {
  if (type === 'waiver') return WAIVER_STARTER_TEXT;
  if (type === 'nda') return NDA_STARTER_TEXT;
  if (type === 'contract') return CONTRACT_STARTER_TEXT;
  if (type === 'approval') return APPROVAL_STARTER_TEXT;
  return '';
}

/** Built-in Send Docs types that share the host legal notice. */
export function bookingAgreementSmbType(
  type: string | null | undefined,
): 'waiver' | 'nda' | 'contract' | null {
  if (type === 'waiver' || type === 'nda' || type === 'contract') return type;
  return null;
}

export function resolveBookingAgreement(service: {
  require_nda?: boolean | null;
  booking_agreement_type?: string | null;
  booking_agreement_text?: string | null;
  booking_agreement_file_id?: string | null;
  booking_agreement_file_path?: string | null;
  booking_agreement_file_name?: string | null;
}): {
  type: BookingAgreementType;
  label: string;
  body: string;
  filePath: string | null;
  fileName: string | null;
} | null {
  if (!service.require_nda) return null;
  const typeExplicit = isBookingAgreementType(service.booking_agreement_type);
  const type = typeExplicit ? service.booking_agreement_type : 'nda';
  const filePath = service.booking_agreement_file_path?.trim() || null;
  const fileName = service.booking_agreement_file_name?.trim() || null;
  if (filePath) {
    return { type, label: bookingAgreementLabel(type), body: '', filePath, fileName };
  }
  const custom = service.booking_agreement_text?.trim();
  const body = custom
    || (typeExplicit ? defaultBookingAgreementText(type) : LEGACY_BOOKING_NDA_TEXT)
    || LEGACY_BOOKING_NDA_TEXT;
  return { type, label: bookingAgreementLabel(type), body, filePath: null, fileName: null };
}
