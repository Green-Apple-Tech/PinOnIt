import { describe, expect, it } from 'vitest';
import {
  AUDIT_RECORD_ITEMS,
  ESIGN_CONSENT_STATEMENT,
  HOLD_UP_COPY,
  LEGAL_DISCLAIMER,
} from './documentCopy';

describe('e-sign factual copy', () => {
  it('uses ESIGN + audit language without outcome claims', () => {
    expect(HOLD_UP_COPY).toMatch(/ESIGN Act/);
    expect(HOLD_UP_COPY).toMatch(/audit record/);
    expect(HOLD_UP_COPY).not.toMatch(/legally binding|court-proven|holds up|iron-?clad|enforceable/i);
    expect(LEGAL_DISCLAIMER).toMatch(/does not provide legal advice/i);
    expect(ESIGN_CONSENT_STATEMENT).toMatch(/consent to do business electronically/i);
    expect(ESIGN_CONSENT_STATEMENT).toMatch(/receive related records electronically/i);
    expect(AUDIT_RECORD_ITEMS).toHaveLength(9);
    expect(AUDIT_RECORD_ITEMS.join(' ')).toMatch(/SHA-256/);
    expect(AUDIT_RECORD_ITEMS.join(' ')).toMatch(/Unique document ID/);
  });
});
