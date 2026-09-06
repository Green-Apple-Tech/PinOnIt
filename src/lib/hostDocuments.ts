import type { SmbDocumentType } from './types';

/** Document types editable as host defaults in Settings → Docs. */
export const HOST_EDITABLE_TEMPLATE_TYPES: SmbDocumentType[] = [
  'nda',
  'contract',
  'waiver',
  'quote',
  'invoice',
  'receipt',
  'quick_addendum',
];

export type HostDocumentTemplate = {
  id: string;
  host_id: string;
  document_type: SmbDocumentType;
  full_text: string;
  plain_language_summary?: string | null;
  plain_language_source_hash?: string | null;
  plain_language_enabled?: boolean | null;
  plain_language_truncated?: boolean | null;
  updated_at: string;
  created_at: string;
};

export type HostDocumentFile = {
  id: string;
  host_id: string;
  name: string;
  file_path: string;
  file_name: string;
  file_size_bytes: number;
  created_at: string;
};
