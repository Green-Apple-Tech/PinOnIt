import type { DocumentConfirmationType, SmbDocumentType } from './types';

export type DocumentTypeOption = {
  id: SmbDocumentType;
  label: string;
  /** Short helper for senders — not shown as a category. */
  hint: string;
  confirmationType: DocumentConfirmationType;
};

/**
 * Canonical Document Type catalog for Doc Center.
 * One flat list — no industry/profession grouping.
 * Add templates per type later using the same `id` values.
 */
export const SMB_DOCUMENT_TYPES: DocumentTypeOption[] = [
  { id: 'invoice', label: 'Invoice', hint: 'What they owe', confirmationType: 'approve' },
  { id: 'receipt', label: 'Receipt', hint: 'Confirm they received it', confirmationType: 'confirm_receipt' },
  { id: 'quote', label: 'Estimate / Quote', hint: 'Estimate before they say yes', confirmationType: 'approve' },
  { id: 'work_order', label: 'Work Order', hint: 'Authorize the work', confirmationType: 'approve' },
  { id: 'change_order', label: 'Change Order', hint: 'Approve a change', confirmationType: 'approve' },
  { id: 'service_agreement', label: 'Service Agreement', hint: 'Agree to service terms', confirmationType: 'sign' },
  { id: 'scope_of_work', label: 'Scope of Work', hint: 'Confirm what is included', confirmationType: 'approve' },
  { id: 'nda', label: 'NDA', hint: 'Keep talks confidential', confirmationType: 'sign' },
  { id: 'waiver', label: 'Waiver / Liability Release', hint: 'Sign a liability waiver', confirmationType: 'sign' },
  { id: 'quick_addendum', label: 'Quick Addendum', hint: 'Short add-on to sign by text', confirmationType: 'sign' },
  { id: 'consent_form', label: 'Consent Form', hint: 'Record consent', confirmationType: 'sign' },
  { id: 'cancellation_policy', label: 'Cancellation Policy', hint: 'Acknowledge cancel terms', confirmationType: 'approve' },
  { id: 'credit_card_authorization', label: 'Credit Card Authorization', hint: 'Authorize card charges', confirmationType: 'sign' },
  { id: 'recurring_service_authorization', label: 'Recurring Service Authorization', hint: 'Authorize ongoing service', confirmationType: 'sign' },
  { id: 'property_access_authorization', label: 'Property Access Authorization', hint: 'Allow property access', confirmationType: 'sign' },
  { id: 'key_access_receipt', label: 'Key / Access Receipt', hint: 'Confirm keys or access given', confirmationType: 'confirm_receipt' },
  { id: 'inspection_acknowledgment', label: 'Inspection Acknowledgment', hint: 'Acknowledge an inspection', confirmationType: 'approve' },
  { id: 'completion_sign_off', label: 'Completion / Job Sign-Off', hint: 'Confirm the job is done', confirmationType: 'approve' },
  { id: 'delivery_acceptance', label: 'Delivery Acceptance', hint: 'Accept a delivery', confirmationType: 'confirm_receipt' },
  { id: 'damage_condition_report', label: 'Damage / Condition Report', hint: 'Record condition or damage', confirmationType: 'approve' },
  { id: 'rental_agreement', label: 'Rental Agreement', hint: 'Agree to rental terms', confirmationType: 'sign' },
  { id: 'photo_video_release', label: 'Photo / Video Release', hint: 'Allow photo or video use', confirmationType: 'sign' },
  { id: 'parent_minor_consent', label: 'Parent / Minor Consent', hint: 'Parent or guardian consent', confirmationType: 'sign' },
  { id: 'emergency_authorization', label: 'Emergency Authorization', hint: 'Authorize emergency action', confirmationType: 'sign' },
  { id: 'walkthrough', label: 'Walkthrough / Final Walkthrough', hint: 'Acknowledge a walkthrough', confirmationType: 'approve' },
  { id: 'showing_acknowledgment', label: 'Showing Acknowledgment', hint: 'Acknowledge a showing', confirmationType: 'approve' },
  { id: 'repair_confirmation', label: 'Repair Confirmation', hint: 'Confirm repair work', confirmationType: 'approve' },
  { id: 'maintenance_approval', label: 'Maintenance Approval', hint: 'Approve maintenance', confirmationType: 'approve' },
  /** Kept for existing Doc Center / deep links — same catalog, not an industry filter. */
  { id: 'contract', label: 'Contract', hint: 'Sign the terms', confirmationType: 'sign' },
  { id: 'upload', label: 'Upload PDF to sign', hint: 'Your PDF + SMS code + finger sign', confirmationType: 'sign' },
  { id: 'other', label: 'Other', hint: 'Custom document type', confirmationType: 'approve' },
];

export const MONEY_DOCUMENT_TYPES: SmbDocumentType[] = ['quote', 'invoice', 'receipt'];

export const DOCUMENT_UPLOAD_MAX_BYTES = 10 * 1024 * 1024;
export const DOCUMENT_UPLOAD_BUCKET = 'document-files';

export function isUploadDocumentType(type: SmbDocumentType) {
  return type === 'upload';
}

export function isMoneyDocumentType(type: SmbDocumentType) {
  return MONEY_DOCUMENT_TYPES.includes(type);
}

export function isSmbDocumentType(value: string): value is SmbDocumentType {
  return SMB_DOCUMENT_TYPES.some((t) => t.id === value);
}

export function documentTypeMeta(type: SmbDocumentType) {
  return SMB_DOCUMENT_TYPES.find((t) => t.id === type);
}

/** Display label for senders and recipients. Pass custom when type is `other`. */
export function documentTypeLabel(type: SmbDocumentType, custom?: string | null) {
  if (type === 'other') {
    const trimmed = custom?.trim();
    return trimmed || 'Other';
  }
  return documentTypeMeta(type)?.label ?? type;
}

export function defaultVerificationRequired(type: SmbDocumentType) {
  return type === 'nda' || type === 'contract' || type === 'waiver' || type === 'upload' || type === 'quick_addendum';
}

export function documentBodyIsEditable(type: SmbDocumentType) {
  return type === 'nda' || type === 'contract' || type === 'waiver' || type === 'quick_addendum';
}

export function documentNeedsRecipientAction(type: SmbDocumentType) {
  return type !== 'quote';
}

export function documentFilePublicUrl(filePath: string) {
  const base = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  if (!base || !filePath) return null;
  return `${base.replace(/\/$/, '')}/storage/v1/object/public/${DOCUMENT_UPLOAD_BUCKET}/${filePath}`;
}

/** Simple shared body for types that only identify the document for now. */
export const GENERIC_DOCUMENT_STARTER_TEXT = `DOCUMENT ACKNOWLEDGMENT

Prepared for: [Recipient Name]

This document is provided by [Business Name] regarding: [Activity/Service Description].

By confirming or signing, you acknowledge that you have reviewed this document and the information described above. Keep a copy for your records.

This is a general-purpose starting template. It is not legal advice. Consult an attorney for documents that must meet specific legal or regulatory requirements.`;
