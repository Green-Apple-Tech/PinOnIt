import { describe, expect, it } from 'vitest';
import {
  SMB_DOCUMENT_TYPES,
  documentTypeLabel,
  isSmbDocumentType,
  isMoneyDocumentType,
} from './documentTypes';

describe('document type catalog', () => {
  it('includes the core money and legal types', () => {
    expect(isSmbDocumentType('invoice')).toBe(true);
    expect(isSmbDocumentType('receipt')).toBe(true);
    expect(isSmbDocumentType('quote')).toBe(true);
    expect(isSmbDocumentType('nda')).toBe(true);
    expect(isSmbDocumentType('waiver')).toBe(true);
    expect(isSmbDocumentType('contract')).toBe(true);
    expect(isSmbDocumentType('other')).toBe(true);
    expect(isSmbDocumentType('work_order')).toBe(true);
  });

  it('keeps money types limited to invoice, receipt, and quote', () => {
    expect(isMoneyDocumentType('invoice')).toBe(true);
    expect(isMoneyDocumentType('work_order')).toBe(false);
  });

  it('labels Estimate / Quote and Other with a custom name', () => {
    expect(documentTypeLabel('quote')).toBe('Estimate / Quote');
    expect(documentTypeLabel('waiver')).toBe('Waiver / Liability Release');
    expect(documentTypeLabel('other')).toBe('Other');
    expect(documentTypeLabel('other', ' Equipment form ')).toBe('Equipment form');
  });

  it('includes upload-to-sign and Quick Addendum in the catalog', () => {
    expect(isSmbDocumentType('upload')).toBe(true);
    expect(documentTypeLabel('upload')).toBe('Upload PDF to sign');
    expect(isSmbDocumentType('quick_addendum')).toBe(true);
    expect(documentTypeLabel('quick_addendum')).toBe('Quick Addendum');
  });

  it('is a flat list with unique ids', () => {
    const ids = SMB_DOCUMENT_TYPES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
