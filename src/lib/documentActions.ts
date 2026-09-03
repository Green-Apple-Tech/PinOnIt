import type { SmbDocumentType } from './types';
import { defaultVerificationRequired } from './documentTypes';

/** Shared Doc Center “what do you want to do?” actions — one create page, different entry points. */
export type DocumentActionId =
  | 'sign'
  | 'send'
  | 'quote'
  | 'invoice'
  | 'receipt'
  | 'waiver'
  | 'nda'
  | 'addendum'
  | 'agreement';

export type DocumentAction = {
  id: DocumentActionId;
  label: string;
  /** Default document_type when this action is chosen. */
  defaultType: SmbDocumentType;
  /** Optional: limit the type dropdown to these ids (undefined = full catalog). */
  typeFilter?: SmbDocumentType[];
};

export const DOCUMENT_ACTIONS: DocumentAction[] = [
  {
    id: 'sign',
    label: 'Send for Signature',
    defaultType: 'nda',
    typeFilter: ['nda', 'contract', 'waiver', 'quick_addendum', 'upload', 'service_agreement', 'consent_form'],
  },
  {
    id: 'send',
    label: 'Send Document',
    defaultType: 'other',
    typeFilter: undefined,
  },
  { id: 'quote', label: 'Send Quote', defaultType: 'quote', typeFilter: ['quote'] },
  { id: 'invoice', label: 'Send Invoice', defaultType: 'invoice', typeFilter: ['invoice'] },
  { id: 'receipt', label: 'Send Receipt', defaultType: 'receipt', typeFilter: ['receipt'] },
  { id: 'waiver', label: 'Send Waiver', defaultType: 'waiver', typeFilter: ['waiver'] },
  { id: 'nda', label: 'Send NDA', defaultType: 'nda', typeFilter: ['nda'] },
  { id: 'addendum', label: 'Send Addendum', defaultType: 'quick_addendum', typeFilter: ['quick_addendum'] },
  {
    id: 'agreement',
    label: 'Send Simple Agreement',
    defaultType: 'contract',
    typeFilter: ['contract', 'service_agreement'],
  },
];

export function isDocumentActionId(value: string | null | undefined): value is DocumentActionId {
  return DOCUMENT_ACTIONS.some((a) => a.id === value);
}

export function documentActionById(id: DocumentActionId): DocumentAction {
  return DOCUMENT_ACTIONS.find((a) => a.id === id) ?? DOCUMENT_ACTIONS[0];
}

/** Resolve action from URL: prefer ?action=, else infer from ?type=. */
export function resolveDocumentAction(
  actionParam: string | null,
  typeParam: string | null,
): DocumentAction {
  if (actionParam && isDocumentActionId(actionParam)) {
    return documentActionById(actionParam);
  }
  if (typeParam === 'quote') return documentActionById('quote');
  if (typeParam === 'invoice') return documentActionById('invoice');
  if (typeParam === 'receipt') return documentActionById('receipt');
  if (typeParam === 'waiver') return documentActionById('waiver');
  if (typeParam === 'nda') return documentActionById('nda');
  if (typeParam === 'quick_addendum') return documentActionById('addendum');
  if (typeParam === 'contract' || typeParam === 'service_agreement') return documentActionById('agreement');
  if (typeParam === 'upload') return documentActionById('sign');
  if (typeParam && defaultVerificationRequired(typeParam as SmbDocumentType)) {
    return documentActionById('sign');
  }
  return documentActionById('send');
}

export function documentsNewPath(action: DocumentActionId, type?: SmbDocumentType) {
  const a = documentActionById(action);
  const t = type ?? a.defaultType;
  return `/dashboard/documents/new?action=${a.id}&type=${t}`;
}
