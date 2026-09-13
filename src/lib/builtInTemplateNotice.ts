import type { SmbDocumentType } from './types';

/** Boilerplate we relocated out of signed bodies. */
const KNOWN_JARGON = [
  /This is a general-purpose starting template\. Enforceability of liability[\s\S]*?before relying on it\.?/gi,
  /This is a general-purpose starting template, not legal advice\.[\s\S]*?for your situation\.?/gi,
  /This is a general-purpose starting template\. It is not legal advice\.[\s\S]*?(requirements|transactions|rentals)\.?/gi,
  /This is a general-purpose starting template\. It is not legal advice\.?/gi,
];

const KIND_LABEL: Partial<Record<SmbDocumentType, string>> = {
  waiver: 'waiver',
  parental_consent_waiver: 'waiver with parental consent',
  nda: 'NDA',
  contract: 'contract',
  quick_addendum: 'addendum',
  service_agreement: 'service agreement',
  photo_video_release: 'photo release',
  consent_form: 'consent form',
  rental_agreement: 'rental agreement',
  quote: 'estimate',
  invoice: 'invoice',
  receipt: 'receipt',
  work_order: 'work order',
  change_order: 'change order',
  scope_of_work: 'scope of work',
  cancellation_policy: 'cancellation policy',
  credit_card_authorization: 'credit card authorization',
  recurring_service_authorization: 'recurring service authorization',
  property_access_authorization: 'property access authorization',
  key_access_receipt: 'key receipt',
  inspection_acknowledgment: 'inspection acknowledgment',
  completion_sign_off: 'completion sign-off',
  delivery_acceptance: 'delivery acceptance',
  damage_condition_report: 'damage report',
  walkthrough: 'walkthrough',
  showing_acknowledgment: 'showing acknowledgment',
  repair_confirmation: 'repair confirmation',
  maintenance_approval: 'maintenance approval',
};

export function stripKnownTemplateJargon(text: string) {
  let next = text;
  for (const pattern of KNOWN_JARGON) {
    next = next.replace(pattern, '');
  }
  return next.replace(/\n{3,}/g, '\n\n').trim();
}

export function normalizeTemplateText(text: string) {
  return stripKnownTemplateJargon(text).replace(/\s+/g, ' ').trim();
}

export function builtInTemplateKindLabel(type: SmbDocumentType) {
  return KIND_LABEL[type] || type.replace(/_/g, ' ');
}

/** One consistent host-only line. Never predicts a legal outcome. */
export function builtInTemplateAttorneyLine(type: SmbDocumentType) {
  return `(Standard ${builtInTemplateKindLabel(type)} language — attorney review recommended.)`;
}

export function showsBuiltInAttorneyLine(type: SmbDocumentType) {
  return type !== 'upload' && type !== 'other';
}

export function isUnmodifiedBuiltInTemplate(type: SmbDocumentType, text: string, builtinText: string) {
  if (!showsBuiltInAttorneyLine(type)) return false;
  const current = normalizeTemplateText(text);
  if (!current) return false;
  return current === normalizeTemplateText(builtinText);
}
