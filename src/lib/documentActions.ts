import type { SmbDocumentType } from './types';

/** How the user opened the shared create page — only affects the verification checkbox default. */
export type DocsEntryMode = 'sign' | 'send';

/** Convenience “What do you want to do?” choices — same page, full type list always. */
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
  defaultType: SmbDocumentType;
};

export const DOCUMENT_ACTIONS: DocumentAction[] = [
  { id: 'sign', label: 'Send for Signature', defaultType: 'nda' },
  { id: 'send', label: 'Send Document', defaultType: 'other' },
  { id: 'quote', label: 'Send Quote', defaultType: 'quote' },
  { id: 'invoice', label: 'Send Invoice', defaultType: 'invoice' },
  { id: 'receipt', label: 'Send Receipt', defaultType: 'receipt' },
  { id: 'waiver', label: 'Send Waiver', defaultType: 'waiver' },
  { id: 'nda', label: 'Send NDA', defaultType: 'nda' },
  { id: 'addendum', label: 'Send Addendum', defaultType: 'quick_addendum' },
  { id: 'agreement', label: 'Send Simple Agreement', defaultType: 'contract' },
];

export function isDocumentActionId(value: string | null | undefined): value is DocumentActionId {
  return DOCUMENT_ACTIONS.some((a) => a.id === value);
}

export function documentActionById(id: DocumentActionId): DocumentAction {
  return DOCUMENT_ACTIONS.find((a) => a.id === id) ?? DOCUMENT_ACTIONS[0];
}

/** Prefer ?mode= deep links. Legacy ?action=sign|send still works. */
export function resolveDocsEntryMode(
  modeParam: string | null,
  actionParam: string | null,
): DocsEntryMode {
  if (modeParam === 'sign' || modeParam === 'send') return modeParam;
  if (actionParam === 'sign') return 'sign';
  if (actionParam === 'send') return 'send';
  return 'send';
}

/** Map dropdown / ?type= to a convenience action id (does not control verification). */
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
  return documentActionById('send');
}

/** Build create-doc URL. Mode is optional (legacy deep links); type alone is enough for defaults. */
export function documentsNewPath(mode?: DocsEntryMode | null, type?: SmbDocumentType) {
  const q = new URLSearchParams();
  if (mode === 'sign' || mode === 'send') q.set('mode', mode);
  if (type) q.set('type', type);
  const qs = q.toString();
  return qs ? `/dashboard/documents/new?${qs}` : '/dashboard/documents/new';
}
